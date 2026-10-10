import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiGet } from "../lib/api";
import { fixed, pct, usd } from "../lib/format";
import { Async, EmptyState, ErrorState } from "../components/States";
import { Direction } from "../components/ui";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("formatters", () => {
  it("formats prices by magnitude", () => {
    expect(usd(160146.7)).toBe("$160,147");
    expect(usd(74.5926)).toBe("$74.59");
    expect(usd(null)).toBe("—");
  });
  it("adds a sign to positive percentages", () => {
    expect(pct(0.533)).toBe("+0.53%");
    expect(pct(-1.2, 1)).toBe("-1.2%");
  });
  it("keeps decimals consistent", () => {
    expect(fixed(24, 1)).toBe("24.0");
  });
});

describe("api client", () => {
  it("turns a backend error body into an ApiError", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: "coin_not_found", detail: "'DOGE' is not supported." }),
    });
    await expect(apiGet("/market/DOGE")).rejects.toMatchObject({ status: 404, code: "coin_not_found" });
  });
  it("reports an unreachable backend as a network error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(apiGet("/health")).rejects.toMatchObject({ code: "network" });
  });
});

describe("states", () => {
  it("shows loading, then error with a retry button and a fix hint", () => {
    const reload = vi.fn();
    const { rerender } = render(
      <Async q={{ loading: true, data: null, error: null, reload }}>{() => <p>data</p>}</Async>,
    );
    expect(screen.getByRole("status")).toBeTruthy();

    const err = new ApiError(503, "data_not_ready", "model_arena_results.csv not found");
    rerender(<Async q={{ loading: false, data: null, error: err, reload }}>{() => <p>data</p>}</Async>);
    expect(screen.getByRole("alert").textContent).toContain("run_pipeline.py");
    fireEvent.click(screen.getByText("Try again"));
    expect(reload).toHaveBeenCalledOnce();
  });

  it("renders data when loaded", () => {
    render(<Async q={{ loading: false, data: { v: 7 }, error: null }}>{(d) => <p>value {d.v}</p>}</Async>);
    expect(screen.getByText("value 7")).toBeTruthy();
  });

  it("renders an empty state", () => {
    render(<EmptyState title="No sentiment logged yet">Run the logger.</EmptyState>);
    expect(screen.getByText("No sentiment logged yet")).toBeTruthy();
  });

  it("error state works without a retry handler", () => {
    render(<ErrorState error={new ApiError(0, "network", "Can't reach the API")} />);
    expect(screen.getByRole("alert").textContent).toContain("uvicorn");
  });
});

describe("direction badge", () => {
  it("never relies on color alone", () => {
    render(<Direction dir="DOWN" />);
    expect(screen.getByText("Down")).toBeTruthy();
    expect(screen.getByText("▼")).toBeTruthy();
  });
});

describe("routing", () => {
  it("rejects an unsupported coin in the URL", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, status: 200, json: async () => [] });
    const { default: App } = await import("../App");
    // App has its own BrowserRouter, so drive it through window.history
    window.history.pushState({}, "", "/dashboard?coin=DOGE");
    render(<App />);
    expect(await screen.findByText(/"DOGE" isn't a supported cryptocurrency/)).toBeTruthy();
  });
});

describe("assistant answer rendering", () => {
  it("renders bold text and bullet lists without injecting HTML", async () => {
    const { Markdown } = await import("../lib/markdown");
    const { container } = render(
      <Markdown text={"Price is **$100**.\n\n- first point\n- second <b>point</b>"} />,
    );
    expect(container.querySelector("strong").textContent).toBe("$100");
    expect(container.querySelectorAll("li")).toHaveLength(2);
    expect(container.querySelector("b")).toBeNull(); // raw HTML stays as text
    expect(container.textContent).toContain("second <b>point</b>");
  });
});

describe("storage helpers", () => {
  it("fall back gracefully when storage is blocked", async () => {
    const { load, save } = await import("../lib/storage");
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(load("x", [1])).toEqual([1]);
    expect(() => save("x", [2])).not.toThrow();
  });
});

describe("api client", () => {
  it("sends portfolio holdings as a JSON POST", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: 1 }) });
    const { api } = await import("../lib/api");
    await api.portfolio([{ coin: "BTC", amount: 1 }]);
    const [url, opts] = spy.mock.calls[0];
    expect(url).toContain("/api/portfolio");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual({ holdings: [{ coin: "BTC", amount: 1 }] });
  });
});
