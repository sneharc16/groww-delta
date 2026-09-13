import {expect,test} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("core screens and driver dialog support accessible responsive navigation",async({page},testInfo)=>{
  test.setTimeout(120000);
  for(const width of [390,768,1440]) {
    await page.setViewportSize({width,height:900});
    for(const path of ["/","/watchlist","/stock/INDIGO","/demo"]) {
      await page.goto(path);
      await expect(page.getByRole("heading",{level:1})).toBeVisible();
      await expect(page.getByRole("status").filter({hasText:/Loading|Comparing/})).toHaveCount(0);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      const results=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze();
      expect(results.violations,path+" at "+width).toEqual([]);
      if (path === "/stock/INDIGO" && width === 390) await page.screenshot({path:testInfo.outputPath("mobile-stock.png"),fullPage:true});
    }
  }
  await page.setViewportSize({width:390,height:900});
  await page.goto("/stock/INDIGO");
  const edit=page.getByTestId("related-drivers-section").getByRole("button",{name:"Edit",exact:true});
  await edit.focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  expect((await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze()).violations).toEqual([]);
  await page.keyboard.press("Escape"); await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("attention, trust, Calm Mode and corporate review remain accessible on mobile",async({page},testInfo)=>{
  test.setTimeout(120000);
  await page.setViewportSize({width:390,height:844});
  const request=page.request;
  await request.post("/api/session");
  for(const [scenario,steps] of [["groww-delta-default",2],["data-quality",1],["market-shock",1],["corporate-action",1]] as const) {
    expect((await request.post("/api/demo/scenario",{data:{scenarioId:scenario}})).ok()).toBe(true);
    for(let i=0;i<steps;i++)expect((await request.post("/api/demo/advance")).ok()).toBe(true);
    await page.goto("/");
    await expect(page.getByRole("heading",{level:1})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    expect((await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze()).violations,scenario).toEqual([]);
    if (scenario === "market-shock") await page.screenshot({path:testInfo.outputPath("mobile-calm.png"),fullPage:true});
  }
});
