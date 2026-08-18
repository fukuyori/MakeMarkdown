/*
 * MakeMarkdown - 設定画面
 */
"use strict";

const DEFAULTS = {
  monitorLongest: false,
  fetchOriginal: false,
  waitMs: 1200,
};

const ORIGINS = { origins: ["*://*/*"] };
const $ = (id) => document.getElementById(id);

function setStatus(message, warn) {
  const el = $("monitor-status");
  el.textContent = message || "";
  el.classList.toggle("warn", Boolean(warn));
}

async function refreshStatus() {
  const { monitorLongest } = await browser.storage.local.get(DEFAULTS);
  const granted = await browser.permissions.contains(ORIGINS);
  $("monitor").checked = monitorLongest && granted;
  if (monitorLongest && !granted) {
    setStatus(t("statusNoPermission"), true);
  } else if (monitorLongest) {
    setStatus(t("statusRecording"));
  } else {
    setStatus("");
  }
}

async function onMonitorChange(event) {
  const wanted = event.target.checked;

  if (wanted) {
    let granted = await browser.permissions.contains(ORIGINS);
    if (!granted) {
      // 権限の要求はユーザー操作の中でしか行えない
      granted = await browser.permissions.request(ORIGINS);
    }
    if (!granted) {
      event.target.checked = false;
      setStatus(t("statusPermissionDenied"), true);
      return;
    }
    await browser.storage.local.set({ monitorLongest: true });
  } else {
    await browser.storage.local.set({ monitorLongest: false });
    await browser.permissions.remove(ORIGINS).catch(() => {});
  }

  await browser.runtime.sendMessage({ type: "syncRecorder" }).catch(() => {});
  await refreshStatus();
}

async function init() {
  localizeDocument();
  const settings = { ...DEFAULTS, ...(await browser.storage.local.get(DEFAULTS)) };

  $("fetch-original").checked = settings.fetchOriginal;
  $("wait").value = settings.waitMs;
  $("wait-out").textContent = t("unitSeconds", (settings.waitMs / 1000).toFixed(1));

  $("monitor").addEventListener("change", onMonitorChange);

  $("fetch-original").addEventListener("change", (e) =>
    browser.storage.local.set({ fetchOriginal: e.target.checked })
  );

  $("wait").addEventListener("input", (e) => {
    const value = Number(e.target.value);
    $("wait-out").textContent = t("unitSeconds", (value / 1000).toFixed(1));
    browser.storage.local.set({ waitMs: value });
  });

  await refreshStatus();
}

init().catch((e) => setStatus(t("statusLoadFailed", (e && e.message) || e), true));
