import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { APP_VERSION } from "@/lib/app-version";

const hooks = vi.hoisted(() => ({
  role: "admin" as "admin" | "user" | "tester" | "guest",
  getLatestRelease: vi.fn(),
}));

vi.mock("./auth-gate", () => ({
  useAccount: () => ({ id: "account-test", username: "jana", role: hooks.role }),
}));
vi.mock("@/lib/api/client", () => ({ getLatestRelease: hooks.getLatestRelease }));

import { AppVersionLabel } from "./app-version-label";

const [major = 0, minor = 0] = APP_VERSION.split(".").map(Number);
const newerVersion = `${major}.${minor + 1}.0`;
const releaseUrl = `https://github.com/vvojtisek/chem-app/releases/tag/v${newerVersion}`;

beforeEach(() => {
  hooks.role = "admin";
  hooks.getLatestRelease.mockReset();
});

afterEach(cleanup);

describe("AppVersionLabel", () => {
  it("links administrators to the notes of a newer release", async () => {
    hooks.getLatestRelease.mockResolvedValue({ latestVersion: newerVersion, releaseUrl });
    render(<AppVersionLabel />);

    const link = await screen.findByRole("link", { name: new RegExp(`v${newerVersion}`) });
    expect(link).toHaveAttribute("href", releaseUrl);
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByTitle("Verze aplikace")).toHaveTextContent(`v${APP_VERSION}`);
  });

  it.each([
    ["the installed version", { latestVersion: APP_VERSION, releaseUrl }],
    ["no release information", { latestVersion: null, releaseUrl: null }],
    [
      "a link outside GitHub",
      { latestVersion: newerVersion, releaseUrl: "https://evil.example/release" },
    ],
  ])("shows only the version for %s", async (_case, release) => {
    hooks.getLatestRelease.mockResolvedValue(release);
    render(<AppVersionLabel />);

    await vi.waitFor(() => expect(hooks.getLatestRelease).toHaveBeenCalledOnce());
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByTitle("Verze aplikace")).toHaveTextContent(`v${APP_VERSION}`);
  });

  it("keeps the version visible when the check fails", async () => {
    hooks.getLatestRelease.mockRejectedValue(new Error("offline"));
    render(<AppVersionLabel />);

    await vi.waitFor(() => expect(hooks.getLatestRelease).toHaveBeenCalledOnce());
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it.each(["user", "tester", "guest"] as const)("never asks the server for %s", (role) => {
    hooks.role = role;
    render(<AppVersionLabel />);

    expect(hooks.getLatestRelease).not.toHaveBeenCalled();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
