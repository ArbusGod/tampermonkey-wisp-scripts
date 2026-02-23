// ==UserScript==
// @name         Wisp Tools
// @namespace    wisp-tools
// @version      1.0.3
// @description  Herramientas para sistema WISP
// @author       Equipo
// @match        *://*/wispcontrol/tech/*
// @match        *://*/wispcontrol/*
// @match        *://*/wispro/*
// @match        *://*/fact_fichacli*
// @updateURL    https://raw.githubusercontent.com/ArbusGod/tampermonkey-wisp-scripts/main/script.user.js
// @downloadURL  https://raw.githubusercontent.com/ArbusGod/tampermonkey-wisp-scripts/main/script.user.js
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // =========================
    // >>> CONFIGURACIÓN DE "LLENOS" (EDITAR AQUÍ)
    // =========================

    // >>> AQUÍ AÑADE LOS PUERTOS PON LLENOS <<<
    // Formato: "frame/slot/port" (ej: "0/1/13")
    const FULL_PONS = new Set([
        "0/1/13", // PON lleno (ejemplo / prueba)
        // "0/1/14",
    ]);

    // >>> AQUÍ AÑADE LAS CAJAS LLENAS (UNA POR UNA) <<<
    // Se compara por "nombre base" (por ejemplo "DAES 208"), ignorando "(7)" u otros sufijos del select.
    const FULL_BOX_BASE_NAMES = new Set([
        "DAES 208", // ejemplo: caja llena
        // "SAVI 999",
    ]);

    // =========================
    // UTILIDADES DE LECTURA
    // =========================

    function todayISO() {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function readPon() {
        const frame = (document.getElementById("frame_fiber_register")?.value ?? "").trim();
        const slot = (document.getElementById("slot_fiber_register")?.value ?? "").trim();
        const port = (document.getElementById("port_fiber_register")?.value ?? "").trim();
        if (!frame || !slot || !port) return "";
        return `${frame}/${slot}/${port}`;
    }

    function readBoxText() {
        // 1) Intentar desde el select real
        const sel = document.getElementById("select_box");
        if (sel && sel.selectedIndex >= 0) {
            const txt = (sel.options[sel.selectedIndex]?.textContent || "").trim();
            if (txt) return txt;
        }
        // 2) Fallback para uniform
        return (document.querySelector("#uniform-select_box span")?.textContent || "").trim();
    }

    function normalizeBoxBaseName(boxText) {
        // "DAES 208 (7)" -> "DAES 208"
        // "LOGU 105 (1x8) (0)" -> "LOGU 105"
        const m = boxText.match(/^\s*([A-ZÑ]+)\s+(\d+)\b/i);
        if (!m) return boxText.trim();
        return `${m[1].toUpperCase()} ${m[2]}`;
    }

    // =========================
    // UI: AVISO CERRABLE (NO alert)
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
                width: 240px;
                display: none;
            }

            #${UI_ID} .wisp-title {
                font-weight: bold;
                text-align: center;
                margin-bottom: 8px;
                padding-right: 22px; /* espacio para la X */
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

            #${UI_ID} .wisp-close:hover {
                background: rgba(255,255,255,0.25);
            }

            #${UI_ID} .wisp-body {
                background: rgba(255,255,255,0.10);
                border-radius: 8px;
                padding: 8px;
                font-size: 13px;
                line-height: 1.25;
            }

            #${UI_ID} .wisp-row {
                margin: 4px 0;
            }

            #${UI_ID} .wisp-foot {
                margin-top: 8px;
                font-size: 11px;
                opacity: 0.9;
                text-align: center;
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
            <div class="wisp-foot" id="${UI_ID}-foot"></div>
        `;
        document.body.appendChild(panel);

        panel.querySelector(".wisp-close").addEventListener("click", () => {
            panel.style.display = "none";
        });

        return panel;
    }

    function escapeHtml(s) {
        return String(s)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function showWarningPanel({ pon, boxBase, ponFull, boxFull }) {
        const panel = ensurePanel();
        const body = document.getElementById(`${UI_ID}-body`);
        const foot = document.getElementById(`${UI_ID}-foot`);
        const date = todayISO();

        const lines = [];
        if (ponFull) lines.push(`<div class="wisp-row"><b>Puerto PON lleno:</b> ${escapeHtml(pon)}</div>`);
        if (boxFull) lines.push(`<div class="wisp-row"><b>Caja llena:</b> ${escapeHtml(boxBase)}</div>`);

        body.innerHTML = lines.join("");
        foot.textContent = `Última verificación: ${date}`;
        panel.style.display = "block";
    }

    // =========================
    // LÓGICA DE VERIFICACIÓN
    // =========================

    function checkAndWarnIfFull() {
        const pon = readPon();
        const boxText = readBoxText();
        const boxBase = boxText ? normalizeBoxBaseName(boxText) : "";

        const ponFull = !!pon && FULL_PONS.has(pon);
        const boxFull = !!boxBase && FULL_BOX_BASE_NAMES.has(boxBase);

        // Solo mostrar si detecta "lleno"
        if (!ponFull && !boxFull) return;

        showWarningPanel({ pon, boxBase, ponFull, boxFull });
    }

    function setupAutoCheck() {
        // IMPORTANTE: se ejecuta al cargar -> así sale la advertencia en cada refresh si corresponde
        checkAndWarnIfFull();

        // Si cambian valores en la página, volver a verificar
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

    // Reintentos por carga tardía (WISP a veces renderiza luego)
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
