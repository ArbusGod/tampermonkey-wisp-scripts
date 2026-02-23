// ==UserScript==
// @name         Wisp Tools
// @namespace    wisp-tools
// @version      1.0.4
// @description  Herramientas para sistema WISP
// @author       Equipo
// @match        *://*/wispcontrol/tech/*
// @match        *://*/wispcontrol/*
// @match        *://*/wispro/*
// @match        *://*/fact_fichacli*
// @updateURL    https://raw.githubusercontent.com/ArbusGod/tampermonkey-wisp-scripts/main/script.user.js
// @downloadURL  https://raw.githubusercontent.com/ArbusGod/tampermonkey-wisp-scripts/main/script.user.js
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function () {
    'use strict';

    // =========================
    // >>> CONFIGURACIÓN DE "LLENOS" (EDITAR AQUÍ)
    // =========================

    // >>> AQUÍ AÑADE LOS PUERTOS PON LLENOS <<<
    // Formato: "frame/slot/port" (ej: "0/1/13")
    const FULL_PONS = new Set([
        "0/1/13", // Ejemplo: PON lleno
        // "0/1/14",
    ]);

    // >>> AQUÍ AÑADE LAS CAJAS LLENAS (UNA POR UNA) <<<
    // Se compara por "nombre base" (por ejemplo "DAES 208"), ignorando "(7)" u otros sufijos del select.
    const FULL_BOX_BASE_NAMES = new Set([
        // "DAES 208",
    ]);

    // =========================
    // STORAGE KEYS (Tampermonkey)
    // =========================
    const STORE_KEY_PON_DATES = "wisp_tools_last_verified_pons"; // { "0/1/13": "YYYY-MM-DD", ... }
    const STORE_KEY_BOX_DATES = "wisp_tools_last_verified_boxes"; // { "DAES 208": "YYYY-MM-DD", ... }

    function getPonDates() {
        return GM_getValue(STORE_KEY_PON_DATES, {});
    }
    function setPonDates(obj) {
        GM_setValue(STORE_KEY_PON_DATES, obj);
    }
    function getBoxDates() {
        return GM_getValue(STORE_KEY_BOX_DATES, {});
    }
    function setBoxDates(obj) {
        GM_setValue(STORE_KEY_BOX_DATES, obj);
    }

    // =========================
    // UTILIDADES
    // =========================
    function todayISO() {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function escapeHtml(s) {
        return String(s)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    // =========================
    // LECTURA DE CAMPOS (WISP)
    // =========================
    function readPon() {
        const frame = (document.getElementById("frame_fiber_register")?.value ?? "").trim();
        const slot = (document.getElementById("slot_fiber_register")?.value ?? "").trim();
        const port = (document.getElementById("port_fiber_register")?.value ?? "").trim();
        if (!frame || !slot || !port) return "";
        return `${frame}/${slot}/${port}`;
    }

    function readBoxText() {
        const sel = document.getElementById("select_box");
        if (sel && sel.selectedIndex >= 0) {
            const txt = (sel.options[sel.selectedIndex]?.textContent || "").trim();
            if (txt) return txt;
        }
        return (document.querySelector("#uniform-select_box span")?.textContent || "").trim();
    }

    function normalizeBoxBaseName(boxText) {
        const m = boxText.match(/^\s*([A-ZÑ]+)\s+(\d+)\b/i);
        if (!m) return boxText.trim();
        return `${m[1].toUpperCase()} ${m[2]}`;
    }

    // =========================
    // UI: AVISO CERRABLE + BOTONES VERIFICAR
    // =========================
    const UI_ID = "wisp-warning-panel";
    const UI_STYLE_ID = "wisp-warning-style";

    function ensureStyles() {
        if (document.getElementById(UI_STYLE_ID)) return;
        const style = document.createElement("style");
        style.id = UI_STYLE_ID;
        style.innerHTML = `
            #${UI_ID} {
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: #1e3a8a;
                color: white;
                padding: 12px 12px 10px;
                border-radius: 10px;
                z-index: 999999;
                box-shadow: 0 5px 20px rgba(0,0,0,0.35);
                font-family: Arial, sans-serif;
                width: 260px;
                display: none;
            }

            #${UI_ID} .wisp-title {
                font-weight: bold;
                text-align: center;
                margin-bottom: 8px;
                padding-right: 22px;
            }

            #${UI_ID} .wisp-close {
                position: absolute;
                top: 8px;
                right: 8px;
                width: 22px;
                height: 22px;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                background: rgba(255,255,255,0.15);
                color: white;
                font-weight: bold;
                line-height: 22px;
            }
            #${UI_ID} .wisp-close:hover { background: rgba(255,255,255,0.25); }

            #${UI_ID} .wisp-body {
                background: rgba(255,255,255,0.10);
                border-radius: 8px;
                padding: 8px;
                font-size: 13px;
                line-height: 1.25;
            }

            #${UI_ID} .wisp-row { margin: 6px 0; }

            #${UI_ID} .wisp-muted {
                font-size: 11px;
                opacity: 0.9;
                margin-top: 2px;
            }

            #${UI_ID} .wisp-actions {
                display: grid;
                grid-template-columns: 1fr;
                gap: 6px;
                margin-top: 10px;
            }

            #${UI_ID} .wisp-btn {
                width: 100%;
                border: none;
                padding: 8px;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 700;
                font-size: 12px;
                background: #ffffff;
                color: #0f172a;
            }

            #${UI_ID} .wisp-btn:hover {
                background: #dbeafe;
            }
        `;
        document.head.appendChild(style);
    }

    function ensurePanel() {
        ensureStyles();
        let panel = document.getElementById(UI_ID);
        if (panel) return panel;

        panel = document.createElement("div");
        panel.id = UI_ID;
        panel.innerHTML = `
            <button class="wisp-close" type="button" title="Cerrar">×</button>
            <div class="wisp-title">Wisp Tools</div>
            <div class="wisp-body" id="${UI_ID}-body"></div>
            <div class="wisp-actions" id="${UI_ID}-actions"></div>
        `;
        document.body.appendChild(panel);

        panel.querySelector(".wisp-close").addEventListener("click", () => {
            panel.style.display = "none";
        });

        return panel;
    }

    function renderWarningPanel({ pon, boxBase, ponFull, boxFull, ponDate, boxDate }) {
        const panel = ensurePanel();
        const body = document.getElementById(`${UI_ID}-body`);
        const actions = document.getElementById(`${UI_ID}-actions`);

        const lines = [];

        if (ponFull) {
            lines.push(
                `<div class="wisp-row">
                    <div><b>Puerto PON lleno:</b> ${escapeHtml(pon)}</div>
                    <div class="wisp-muted">Última verificación: <b>${escapeHtml(ponDate)}</b></div>
                </div>`
            );
        }

        if (boxFull) {
            lines.push(
                `<div class="wisp-row">
                    <div><b>Caja llena:</b> ${escapeHtml(boxBase)}</div>
                    <div class="wisp-muted">Última verificación: <b>${escapeHtml(boxDate)}</b></div>
                </div>`
            );
        }

        body.innerHTML = lines.join("");
        actions.innerHTML = "";

        if (ponFull) {
            const btn = document.createElement("button");
            btn.className = "wisp-btn";
            btn.type = "button";
            btn.textContent = "VERIFICAR PON";
            btn.addEventListener("click", () => {
                const date = todayISO();
                const ponDates = getPonDates();
                ponDates[pon] = date;
                setPonDates(ponDates);
                // re-render con fecha nueva
                renderWarningPanel({
                    pon, boxBase, ponFull, boxFull,
                    ponDate: date,
                    boxDate
                });
            });
            actions.appendChild(btn);
        }

        if (boxFull) {
            const btn = document.createElement("button");
            btn.className = "wisp-btn";
            btn.type = "button";
            btn.textContent = "VERIFICAR CAJA";
            btn.addEventListener("click", () => {
                const date = todayISO();
                const boxDates = getBoxDates();
                boxDates[boxBase] = date;
                setBoxDates(boxDates);
                // re-render con fecha nueva
                renderWarningPanel({
                    pon, boxBase, ponFull, boxFull,
                    ponDate,
                    boxDate: date
                });
            });
            actions.appendChild(btn);
        }

        panel.style.display = "block";
    }

    // =========================
    // LÓGICA: DETECTAR LLENOS + FECHAS
    // =========================
    function ensureDefaultDateIfMissing({ ponFull, boxFull, pon, boxBase }) {
        const today = todayISO();

        let ponDate = "";
        let boxDate = "";

        if (ponFull && pon) {
            const ponDates = getPonDates();
            if (!ponDates[pon]) {
                ponDates[pon] = today; // primera verificación automática
                setPonDates(ponDates);
            }
            ponDate = ponDates[pon] || today;
        }

        if (boxFull && boxBase) {
            const boxDates = getBoxDates();
            if (!boxDates[boxBase]) {
                boxDates[boxBase] = today; // primera verificación automática
                setBoxDates(boxDates);
            }
            boxDate = boxDates[boxBase] || today;
        }

        return { ponDate, boxDate };
    }

    function checkAndWarnIfFull() {
        const pon = readPon();
        const boxText = readBoxText();
        const boxBase = boxText ? normalizeBoxBaseName(boxText) : "";

        const ponFull = !!pon && FULL_PONS.has(pon);
        const boxFull = !!boxBase && FULL_BOX_BASE_NAMES.has(boxBase);

        if (!ponFull && !boxFull) return;

        const { ponDate, boxDate } = ensureDefaultDateIfMissing({ ponFull, boxFull, pon, boxBase });

        renderWarningPanel({
            pon,
            boxBase,
            ponFull,
            boxFull,
            ponDate,
            boxDate
        });
    }

    function setupAutoCheck() {
        // Al cargar (cada refresh): si corresponde, sale el aviso
        checkAndWarnIfFull();

        // Si cambian valores, vuelve a verificar
        const ponIds = ["frame_fiber_register", "slot_fiber_register", "port_fiber_register"];
        for (const id of ponIds) {
            const el = document.getElementById(id);
            if (!el) continue;
            el.addEventListener("input", checkAndWarnIfFull);
            el.addEventListener("change", checkAndWarnIfFull);
        }

        const boxSel = document.getElementById("select_box");
        if (boxSel) boxSel.addEventListener("change", checkAndWarnIfFull);
    }

    // Reintentos por carga tardía
    (function bootWithRetries() {
        let tries = 0;
        const maxTries = 40; // ~10s
        const intervalMs = 250;

        const timer = setInterval(() => {
            tries++;

            const hasPonInputs =
                document.getElementById("frame_fiber_register") &&
                document.getElementById("slot_fiber_register") &&
                document.getElementById("port_fiber_register");

            const hasBox =
                document.getElementById("select_box") ||
                document.querySelector("#uniform-select_box span");

            if (hasPonInputs || hasBox) {
                clearInterval(timer);
                setupAutoCheck();
                return;
            }

            if (tries >= maxTries) clearInterval(timer);
        }, intervalMs);
    })();
})();
