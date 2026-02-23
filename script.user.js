// ==UserScript==
// @name         Wisp Tools
// @namespace    wisp-tools
// @version      1.0.6
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

    // =========================
    // OLT IDs (según <select id="select_olt"> value)
    // =========================
    // 1  -> OLT1_DC5_Santoro
    // 2  -> OLT2_DC2_Katy_Flores
    // 3  -> OLT3_DC1_Granja_Kim
    // 4  -> OLT4_DC4_Pirayu
    // 6  -> OLT5_DC9_Eusebio_Ayala
    // 9  -> OLT6_DC6_Piribebuy
    // 10 -> TEST_BRAS
    // 11 -> OLT7_DC10_Atyra
    //
    // Formato FULL_PONS: "oltId/frame/slot/port"
    // Ej: "2/0/1/13"  (OLT2_DC2_Katy_Flores, PON 0/1/13)

    // >>> AQUÍ AÑADE LOS PUERTOS PON LLENOS <<<
    const FULL_PONS = new Set([
        "2/0/1/13", // OLT2_DC2_Katy_Flores + 0/1/13
        // "6/0/1/13", // OLT5_DC9_Eusebio_Ayala + 0/1/13
    ]);

    // >>> AQUÍ AÑADE LAS CAJAS LLENAS (UNA POR UNA) <<<
    const FULL_BOX_BASE_NAMES = new Set([
        "DAES 208",
    ]);

    // =========================
    // STORAGE KEYS (Tampermonkey)
    // =========================
    const STORE_KEY_PON_DATES = "wisp_tools_last_verified_pons_v3"; // { "2/0/1/13": "YYYY-MM-DD", ... }
    const STORE_KEY_BOX_DATES = "wisp_tools_last_verified_boxes_v1"; // { "DAES 208": "YYYY-MM-DD", ... }

    function getPonDates() { return GM_getValue(STORE_KEY_PON_DATES, {}); }
    function setPonDates(obj) { GM_setValue(STORE_KEY_PON_DATES, obj); }
    function getBoxDates() { return GM_getValue(STORE_KEY_BOX_DATES, {}); }
    function setBoxDates(obj) { GM_setValue(STORE_KEY_BOX_DATES, obj); }

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
    function readPonParts() {
        const frame = (document.getElementById("frame_fiber_register")?.value ?? "").trim();
        const slot = (document.getElementById("slot_fiber_register")?.value ?? "").trim();
        const port = (document.getElementById("port_fiber_register")?.value ?? "").trim();
        if (!frame || !slot || !port) return null;
        return { frame, slot, port };
    }

    function readOltFromSelect() {
        const sel = document.getElementById("select_olt");
        if (!sel) return { oltId: "", oltName: "" };

        const oltId = (sel.value || "").trim(); // ID real del sistema
        const oltName = (sel.options?.[sel.selectedIndex]?.textContent || "").trim();
        return { oltId, oltName };
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

    function buildPonKey() {
        const { oltId, oltName } = readOltFromSelect();
        const parts = readPonParts();
        if (!parts) return { ponKey: "", oltId, oltName, ponPretty: "" };

        // Si no hay OLT seleccionada todavía, no comparamos FULL_PONS
        if (!oltId) {
            return {
                ponKey: "",
                oltId,
                oltName,
                ponPretty: `${parts.frame}/${parts.slot}/${parts.port}`,
            };
        }

        const ponKey = `${oltId}/${parts.frame}/${parts.slot}/${parts.port}`;
        const ponPretty = `${parts.frame}/${parts.slot}/${parts.port}`;
        return { ponKey, oltId, oltName, ponPretty };
    }

    // =========================
    // UI
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
                width: 280px;
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
            #${UI_ID} .wisp-muted { font-size: 11px; opacity: 0.9; margin-top: 2px; }
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
            #${UI_ID} .wisp-btn:hover { background: #dbeafe; }
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

    function renderWarningPanel({ ponKey, ponPretty, oltName, ponFull, boxBase, boxFull, ponDate, boxDate }) {
        const panel = ensurePanel();
        const body = document.getElementById(`${UI_ID}-body`);
        const actions = document.getElementById(`${UI_ID}-actions`);

        const lines = [];
        if (ponFull) {
            lines.push(
                `<div class="wisp-row">
                    <div><b>Puerto PON lleno:</b> ${escapeHtml(ponPretty)}</div>
                    ${oltName ? `<div class="wisp-muted">OLT: <b>${escapeHtml(oltName)}</b></div>` : ``}
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
                ponDates[ponKey] = date;
                setPonDates(ponDates);
                renderWarningPanel({ ponKey, ponPretty, oltName, ponFull, boxBase, boxFull, ponDate: date, boxDate });
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
                renderWarningPanel({ ponKey, ponPretty, oltName, ponFull, boxBase, boxFull, ponDate, boxDate: date });
            });
            actions.appendChild(btn);
        }

        panel.style.display = "block";
    }

    // =========================
    // LÓGICA
    // =========================
    function ensureDefaultDateIfMissing({ ponFull, boxFull, ponKey, boxBase }) {
        const today = todayISO();

        let ponDate = "";
        let boxDate = "";

        if (ponFull && ponKey) {
            const ponDates = getPonDates();
            if (!ponDates[ponKey]) {
                ponDates[ponKey] = today;
                setPonDates(ponDates);
            }
            ponDate = ponDates[ponKey] || today;
        }

        if (boxFull && boxBase) {
            const boxDates = getBoxDates();
            if (!boxDates[boxBase]) {
                boxDates[boxBase] = today;
                setBoxDates(boxDates);
            }
            boxDate = boxDates[boxBase] || today;
        }

        return { ponDate, boxDate };
    }

    function checkAndWarnIfFull() {
        const { ponKey, oltName, ponPretty } = buildPonKey();
        const ponFull = !!ponKey && FULL_PONS.has(ponKey);

        const boxText = readBoxText();
        const boxBase = boxText ? normalizeBoxBaseName(boxText) : "";
        const boxFull = !!boxBase && FULL_BOX_BASE_NAMES.has(boxBase);

        if (!ponFull && !boxFull) return;

        const { ponDate, boxDate } = ensureDefaultDateIfMissing({ ponFull, boxFull, ponKey, boxBase });

        renderWarningPanel({
            ponKey,
            ponPretty,
            oltName,
            ponFull,
            boxBase,
            boxFull,
            ponDate,
            boxDate
        });
    }

    function setupAutoCheck() {
        // Al cargar (cada refresh): si corresponde, sale el aviso
        checkAndWarnIfFull();

        // Cambios en PON
        const ponIds = ["frame_fiber_register", "slot_fiber_register", "port_fiber_register"];
        for (const id of ponIds) {
            const el = document.getElementById(id);
            if (!el) continue;
            el.addEventListener("input", checkAndWarnIfFull);
            el.addEventListener("change", checkAndWarnIfFull);
        }

        // Cambios en OLT
        const oltSel = document.getElementById("select_olt");
        if (oltSel) oltSel.addEventListener("change", checkAndWarnIfFull);

        // Cambios en caja
        const boxSel = document.getElementById("select_box");
        if (boxSel) boxSel.addEventListener("change", checkAndWarnIfFull);
    }

    // Reintentos por carga tardía
    (function bootWithRetries() {
        let tries = 0;
        const maxTries = 50; // ~12.5s
        const intervalMs = 250;

        const timer = setInterval(() => {
            tries++;

            const hasPonInputs =
                document.getElementById("frame_fiber_register") &&
                document.getElementById("slot_fiber_register") &&
                document.getElementById("port_fiber_register");

            const hasOlt = document.getElementById("select_olt");
            const hasBox =
                document.getElementById("select_box") ||
                document.querySelector("#uniform-select_box span");

            if (hasPonInputs || hasBox || hasOlt) {
                clearInterval(timer);
                setupAutoCheck();
                return;
            }

            if (tries >= maxTries) clearInterval(timer);
        }, intervalMs);
    })();
})();
