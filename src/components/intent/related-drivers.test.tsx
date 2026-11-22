// @vitest-environment jsdom
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { intentRecord } from "../../../tests/helpers/in-memory";
import { toIntentDto } from "@/server/dto/mappers";
import { apiFetch } from "@/lib/api/client";
import { RelatedDrivers } from "./related-drivers";
vi.mock("@/lib/api/client",()=>({apiFetch:vi.fn().mockRejectedValue(new Error("Driver data unavailable"))}));
afterEach(cleanup);
it("a failed driver lookup is explicit instead of implying no relationships exist",async()=>{
  render(<RelatedDrivers intents={[toIntentDto(intentRecord())]} onChanged={async()=>{}} />);
  expect((await screen.findByRole("alert")).textContent).toContain("Driver data unavailable");
});

it("ignores a late lookup failure for a reason that has since been resolved",async()=>{
  let reject!: (error: Error)=>void;
  vi.mocked(apiFetch).mockImplementationOnce(()=>new Promise((_resolve,fail)=>{ reject=fail; }));
  const view=render(<RelatedDrivers intents={[toIntentDto(intentRecord())]} onChanged={async()=>{}} />);
  await vi.waitFor(()=>expect(reject).toBeDefined());
  view.rerender(<RelatedDrivers intents={[]} onChanged={async()=>{}} />);
  await new Promise(resolve=>setTimeout(resolve,10));
  reject(new Error("No active watch reason was found."));
  await new Promise(resolve=>setTimeout(resolve,10));
  expect(screen.queryByRole("alert")).toBeNull();
});
