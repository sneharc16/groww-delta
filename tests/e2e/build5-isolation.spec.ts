import { expect,test,type APIRequestContext } from "@playwright/test";
async function advance(request:APIRequestContext,count:number) {
  for(let i=0;i<count;i++)expect((await request.post("/api/demo/advance")).ok()).toBe(true);
}
test("two anonymous sessions isolate replay, knowledge, graph, lifecycle, and reset",async({browser})=>{
  const a=await browser.newContext(), b=await browser.newContext();
  try {
    await a.request.post("/api/session"); await b.request.post("/api/session");
    await a.request.patch("/api/session/preferences",{data:{showGroupedMoves:true}});
    expect((await (await b.request.get("/api/session/preferences")).json()).showGroupedMoves).toBe(false);
    await advance(a.request,2);
    await a.request.post("/api/catch-up/acknowledge",{data:{scope:"ALL",throughSequence:2}});
    expect((await (await b.request.get("/api/demo/state")).json()).currentStep).toBe(0);
    await advance(b.request,2);
    expect((await (await b.request.get("/api/catch-up")).json()).counts).toEqual({relevant:4,significant:1,quiet:0});
    expect((await (await a.request.get("/api/catch-up")).json()).counts).toEqual({relevant:0,significant:0,quiet:5});
    await advance(a.request,2);
    expect((await (await a.request.get("/api/catch-up")).json()).counts).toEqual({relevant:1,significant:0,quiet:4});
    expect((await a.request.patch("/api/watch-intents/intent:indigo:driver/graph",{data:{templateKey:"AIRLINE_FUEL_COST",selectedNodeKeys:["FUEL_COST"]}})).ok()).toBe(true);
    expect((await (await b.request.get("/api/watch-intents/intent:indigo:driver/graph")).json()).current.relatedDrivers.map((node:{key:string})=>node.key)).toContain("CRUDE");
    expect((await a.request.post("/api/watch-intents/intent:tcs:earnings/resolve")).ok()).toBe(true);
    const bIntents=await (await b.request.get("/api/watch-intents?instrumentId=NSE:TCS")).json();
    expect(bIntents.intents[0].status).toBe("ACTIVE");
    await a.request.post("/api/demo/reset");
    expect((await (await b.request.get("/api/demo/state")).json()).currentStep).toBe(2);
    const page=await b.newPage(); await page.goto("/"); await expect(page.getByTestId("attention-TCS")).toBeVisible();
    await page.reload(); await expect(page.getByTestId("attention-TCS")).toBeVisible();
    const cookies=await b.cookies();
    expect(cookies.find(cookie=>cookie.name==="delta-session")).toMatchObject({httpOnly:true,sameSite:"Lax"});
  } finally { await a.close();await b.close(); }
});
test("duplicate actions are idempotent and competing edits reject stale versions",async({page})=>{
  const request=page.request;
  await request.post("/api/session");
  const duplicate=await Promise.all(Array.from({length:4},()=>request.post("/api/demo/advance",{headers:{"Idempotency-Key":"same-advance"}})));
  expect(duplicate.every(response=>response.ok())).toBe(true);
  expect((await (await request.get("/api/demo/state")).json()).currentStep).toBe(1);
  const state=await (await request.get("/api/demo/state")).json();
  const position=state.scenario.id+":"+state.generation+":"+state.currentSequence;
  const competing=await Promise.all([1,2].map(index=>request.post("/api/demo/advance",{headers:{"X-Delta-Position":position,"Idempotency-Key":"advance-"+index}})));
  expect(competing.map(response=>response.status()).sort()).toEqual([200,409]);
  const seen=await Promise.all([1,2,3].map(()=>request.post("/api/catch-up/acknowledge",{data:{instrumentIds:["NSE:TCS"],throughSequence:2}})));
  expect(seen.every(response=>response.ok())).toBe(true);
  const timeline=await (await request.get("/api/watch-lifecycle?instrumentId=NSE:TCS")).json();
  expect(timeline.timeline.filter((entry:{kind:string})=>entry.kind==="ACKNOWLEDGED")).toHaveLength(1);
  const edits=await Promise.all([["FUEL_COST"],["FUEL_COST","CRUDE"]].map(selectedNodeKeys=>request.patch("/api/watch-intents/intent:indigo:driver/graph",{headers:{"If-Match":"1"},data:{templateKey:"AIRLINE_FUEL_COST",selectedNodeKeys}})));
  expect(edits.map(response=>response.status()).sort()).toEqual([200,409]);
  const graph=await (await request.get("/api/watch-intents/intent:indigo:driver/graph")).json();
  expect(graph.history).toHaveLength(2);
});
test("analysis errors are explicit and health/input responses do not disclose secrets",async({page})=>{
  const health=await page.request.get("/api/health");
  expect(health.ok()).toBe(true);
  expect(await health.text()).not.toMatch(/postgres:\/\/|DATABASE_URL|password|stack/i);
  await page.route("**/api/catch-up",route=>route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({error:{code:"UNAVAILABLE",message:"Analysis is unavailable"}})}));
  await page.goto("/");
  await expect(page.getByRole("alert").filter({hasText:"Analysis is unavailable"})).toContainText("Analysis is unavailable");
  await expect(page.getByTestId("caught-up-state")).toHaveCount(0);
  expect((await page.request.post("/api/demo/scenario",{data:{scenarioId:"../../bad"}})).status()).toBe(400);
  expect((await page.request.post("/api/demo/reset",{headers:{Origin:"https://untrusted.example"}})).status()).toBe(403);
  expect((await page.request.post("/api/watch-intents",{data:{huge:"x".repeat(33000)}})).status()).toBe(413);
});

test("stock history and mutation failures are explicit, not empty history or success",async({page})=>{
  await page.route("**/api/watch-lifecycle?*",route=>route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({error:{code:"UNAVAILABLE",message:"Watch history unavailable"}})}));
  await page.goto("/stock/TCS");
  await expect(page.getByRole("alert").filter({hasText:"Watch history unavailable"})).toBeVisible();
});

test("a stale tab cannot acknowledge a different replay generation",async({page})=>{
  const request=page.request;
  await request.post("/api/session");
  const old=await (await request.get("/api/demo/state")).json();
  await request.post("/api/demo/reset");
  await advance(request,2);
  const response=await request.post("/api/catch-up/acknowledge",{headers:{"X-Delta-Environment":old.scenario.id+":"+old.generation},data:{scope:"ALL",throughSequence:2}});
  expect(response.status()).toBe(409);
  expect((await (await request.get("/api/catch-up")).json()).counts).toEqual({relevant:4,significant:1,quiet:0});
});

test("a corrupt session fails explicitly and supports deliberate recovery",async({page,context})=>{
  await context.addCookies([{name:"delta-session",value:"not-a-valid-session",url:"http://localhost:3000"}]);
  await page.goto("/");
  await expect(page.getByRole("alert").filter({hasText:"session expired"})).toBeVisible();
  await expect(page.getByTestId("caught-up-state")).toHaveCount(0);
  await page.getByRole("button",{name:"Start a new anonymous demo"}).click();
  await expect(page.getByTestId("caught-up-state")).toBeVisible();
});

test("a stale correction notice cannot acknowledge a reset replay", async ({ page }) => {
  const request = page.request;
  await request.post("/api/demo/scenario", { data: { scenarioId: "data-quality" } });
  await advance(request, 5);
  await request.post("/api/catch-up/acknowledge", { data: { instrumentIds: ["NSE:TCS"], throughSequence: 5 } });
  await advance(request, 1);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Mark correction seen" })).toBeVisible();
  await request.post("/api/demo/reset");
  await advance(request, 6);
  await page.getByRole("button", { name: "Mark correction seen" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "This replay was reset or switched" })).toBeVisible();
  const current = await (await request.get("/api/catch-up")).json();
  expect(current.relevant.some((item: { instrument: { id: string } }) => item.instrument.id === "NSE:TCS")).toBe(true);
});
