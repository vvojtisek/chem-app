import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { APP_VERSION } from "@/lib/app-version";

const hooks = vi.hoisted(() => ({
  role: "admin" as "admin" | "user" | "tester" | "guest",
  getLatestRelease: vi.fn(),
  applyLatestRelease: vi.fn(),
  fetchServedVersion: vi.fn(),
  reloadIntoNewBuild: vi.fn(),
}));

vi.mock("./auth-gate", () => ({
  useAccount: () => ({ id: "account-test", username: "jana", role: hooks.role }),
}));
vi.mock("@/lib/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/client")>();
  return {
    ApiError: actual.ApiError,
    getLatestRelease: hooks.getLatestRelease,
    applyLatestRelease: hooks.applyLatestRelease,
  };
});

vi.mock("@/lib/app-version", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/app-version")>();
  return {
    ...actual,
    fetchServedVersion: hooks.fetchServedVersion,
    reloadIntoNewBuild: hooks.reloadIntoNewBuild,
  };
});

import { ApiError } from "@/lib/api/client";
import { AppVersionLabel } from "./app-version-label";

const [major = 0, minor = 0] = APP_VERSION.split(".").map(Number);
const newerVersion = `${major}.${minor + 1}.0`;
const releaseUrl = `https://github.com/vvojtisek/chem-app/releases/tag/v${newerVersion}`;
const updateButtonName = `Aktualizovat na v${newerVersion}`;

beforeEach(() => {
  hooks.role = "admin";
  hooks.getLatestRelease.mockReset();
  hooks.applyLatestRelease.mockReset();
  hooks.fetchServedVersion.mockReset();
  hooks.reloadIntoNewBuild.mockReset();
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function renderWithNewerRelease() {
  hooks.getLatestRelease.mockResolvedValue({
    latestVersion: newerVersion,
    releaseUrl,
    updatesEnabled: true,
  });
  render(<AppVersionLabel />);
  return screen.findByRole("button", { name: updateButtonName });
}

describe("AppVersionLabel", () => {
  it("offers administrators an update button and the release notes", async () => {
    await renderWithNewerRelease();

    const link = screen.getByRole("link", { name: /Co je nového/ });
    expect(link).toHaveAttribute("href", releaseUrl);
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByTitle("Verze aplikace")).toHaveTextContent(`v${APP_VERSION}`);
  });

  it.each([
    ["disabled", false],
    ["not reported by an older API", undefined],
  ])(
    "shows manual deployment guidance and release notes when updates are %s",
    async (_case, enabled) => {
      hooks.getLatestRelease.mockResolvedValue({
        latestVersion: newerVersion,
        releaseUrl,
        ...(enabled === undefined ? {} : { updatesEnabled: enabled }),
      });
      render(<AppVersionLabel />);

      expect(await screen.findByText("Aktualizace jen ručně")).toHaveAttribute(
        "title",
        expect.stringContaining("správce serveru nasadit ručně"),
      );
      expect(screen.getByRole("link", { name: /Co je nového/ })).toHaveAttribute(
        "href",
        releaseUrl,
      );
      expect(screen.queryByRole("button", { name: updateButtonName })).not.toBeInTheDocument();
      expect(hooks.applyLatestRelease).not.toHaveBeenCalled();
    },
  );

  it("starts the update only after confirmation", async () => {
    hooks.applyLatestRelease.mockResolvedValue(undefined);
    const button = await renderWithNewerRelease();

    fireEvent.click(button);

    expect(window.confirm).toHaveBeenCalledOnce();
    expect(hooks.applyLatestRelease).toHaveBeenCalledOnce();
    expect(await screen.findByRole("status")).toHaveTextContent("Aktualizace probíhá");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("reloads once the server serves a different build", async () => {
    hooks.applyLatestRelease.mockResolvedValue(undefined);
    const button = await renderWithNewerRelease();
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    try {
      hooks.fetchServedVersion.mockRejectedValueOnce(new Error("restarting"));
      hooks.fetchServedVersion.mockResolvedValueOnce(APP_VERSION);
      hooks.fetchServedVersion.mockResolvedValue(newerVersion);
      fireEvent.click(button);
      await screen.findByRole("status");

      await vi.advanceTimersByTimeAsync(20_000);
      expect(hooks.reloadIntoNewBuild).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(10_000);
      expect(hooks.reloadIntoNewBuild).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports an update that never takes effect instead of waiting forever", async () => {
    hooks.applyLatestRelease.mockResolvedValue(undefined);
    hooks.fetchServedVersion.mockResolvedValue(APP_VERSION);
    const button = await renderWithNewerRelease();
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    try {
      fireEvent.click(button);
      await screen.findByRole("status");

      await vi.advanceTimersByTimeAsync(10 * 60_000 + 10_000);

      expect(await screen.findByRole("alert")).toHaveTextContent("watchtower");
      expect(screen.getByRole("button", { name: updateButtonName })).toBeEnabled();
      expect(hooks.reloadIntoNewBuild).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does nothing when the administrator cancels", async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    const button = await renderWithNewerRelease();

    fireEvent.click(button);

    expect(hooks.applyLatestRelease).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: updateButtonName })).toBeEnabled();
  });

  it.each([
    [new ApiError(503, "updates_disabled", "x"), "nejsou na tomto serveru zapnuté"],
    [new ApiError(409, "update_in_progress", "x"), "Aktualizace už probíhá"],
    [new ApiError(429, "too_many_attempts", "x"), "Příliš mnoho pokusů"],
    [new ApiError(503, "update_unavailable", "x"), "nepodařilo spustit"],
    [new TypeError("offline"), "nepodařilo spustit"],
  ])("explains a failed update (%s)", async (error, message) => {
    hooks.applyLatestRelease.mockRejectedValue(error);
    const button = await renderWithNewerRelease();

    fireEvent.click(button);

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByRole("button", { name: updateButtonName })).toBeEnabled();
  });

  it.each([
    ["the installed version", { latestVersion: APP_VERSION, releaseUrl, updatesEnabled: true }],
    ["no release information", { latestVersion: null, releaseUrl: null, updatesEnabled: true }],
    [
      "a link outside GitHub",
      {
        latestVersion: newerVersion,
        releaseUrl: "https://evil.example/release",
        updatesEnabled: true,
      },
    ],
  ])("shows only the version for %s", async (_case, release) => {
    hooks.getLatestRelease.mockResolvedValue(release);
    render(<AppVersionLabel />);

    await vi.waitFor(() => expect(hooks.getLatestRelease).toHaveBeenCalledOnce());
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByTitle("Verze aplikace")).toHaveTextContent(`v${APP_VERSION}`);
  });

  it("shows a release published while the tab was in the background", async () => {
    const laterVersion = `${major}.${minor + 2}.0`;
    await renderWithNewerRelease();
    hooks.getLatestRelease.mockResolvedValue({
      latestVersion: laterVersion,
      releaseUrl: `https://github.com/vvojtisek/chem-app/releases/tag/v${laterVersion}`,
      updatesEnabled: true,
    });

    fireEvent(document, new Event("visibilitychange"));

    expect(
      await screen.findByRole("button", { name: `Aktualizovat na v${laterVersion}` }),
    ).toBeInTheDocument();
    expect(hooks.getLatestRelease).toHaveBeenCalledTimes(2);
  });

  it("keeps the version visible when the check fails", async () => {
    hooks.getLatestRelease.mockRejectedValue(new Error("offline"));
    render(<AppVersionLabel />);

    await vi.waitFor(() => expect(hooks.getLatestRelease).toHaveBeenCalledOnce());
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it.each(["user", "tester", "guest"] as const)("never asks the server for %s", (role) => {
    hooks.role = role;
    render(<AppVersionLabel />);

    expect(hooks.getLatestRelease).not.toHaveBeenCalled();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
