// ==UserScript==
// @name         Wisp Tools
// @namespace    wisp-tools
// @version      1.0.0
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

    console.log("Wisp Tools cargado");

    // =========================
    // CONFIG: CAJAS / PON "LLENOS"
    // =========================
    // >>> AQUÍ ES DONDE VAS A IR AGREGANDO COSAS "LLENAS" <<<
    //
    // 1) PONs llenos: formato "frame/slot/port"
    //    Ejemplo: "0/1/13"
    const FULL_PONS = new Set([
        "0/1/13", // (PROBAR) PON lleno
        // "0/1/14",
        // "0/2/1",
    ]);

    // 2) Cajas llenas por nombre exacto (tal cual se ve en el select)
    //    Ejemplo: "LOGU 108 (1)"
    const FULL_BOXES_EXACT = new Set([
        // "LOGU 108 (1)",
    ]);

    // 3) Cajas llenas por patrón (prefijo).
    //    Tu caso: "zona Logu 100" => todas las cajas LOGU que empiezan con 1**
    //    O sea: LOGU 100..199
    //
    // Si quieres sumar otras zonas/patrones, agrega más reglas aquí.
    const FULL_BOX_RULES = [
        // LOGU 1**
        (boxText) => {
            // boxText viene tipo: "LOGU 108 (1)" o "LOGU 105 (1x8) (0)"
            // Tomamos el número después de "LOGU "
            const m = boxText.match(/^\s*LOGU\s+(\d+)/i);
            if (!m) return false;
            const n = Number(m[1]);
            return Number.isFinite(n) && n >= 100 && n <= 199;
        },
    ];

    // =========================
    // PANEL FLOTANTE
    // =========================
    const panel = document.createElement("div");
    panel.innerHTML = `
        <div id="wisp-panel">
            <div id="wisp-header">Wisp Tools</div>
            <button id="wisp-refresh">Refrescar datos</button>
            <button id="wisp-copy">Copiar cliente</button>
        </div>
    `;

    document.body.appendChild(panel);

    const style = document.createElement("style");
    style.innerHTML = `
        #wisp-panel {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #1e3a8a;
            color: white;
            padding: 12px;
            border-radius: 10px;
            z-index: 9999;
            box-shadow: 0 5px 20px rgba(0,0,0,0.3);
            font-family: Arial;
            width: 160px;
        }

        #wisp-header {
            font-weight: bold;
            margin-bottom: 8px;
            text-align: center;
        }

        #wisp-panel button {
            width: 100%;
            margin-top: 5px;
            border: none;
            padding: 6px;
            border-radius: 6px;
            cursor: pointer;
        }

        #wisp-panel button:hover {
            background: #2563eb;
            color: white;
        }
    `;
    document.head.appendChild(style);

    // =========================
    // ALERTA "LLENO"
    // =========================

    // Para no spammear alert() repetidas veces
    const shownWarnings = new Set();

    function getSelectedBoxText() {
        const sel = document.getElementById("select_box");
        if (!sel || !sel.options || sel.selectedIndex < 0) return "";
        return (sel.options[sel.selectedIndex]?.textContent || "").trim();
    }

    function getPonString() {
        const frame = (document.getElementById("frame_fiber_register")?.value || "").trim();
        const slot  = (document.getElementById("slot_fiber_register")?.value || "").trim();
        const port  = (document.getElementById("port_fiber_register")?.value || "").trim();

        // Solo devolvemos PON si los 3 existen (así NO muestra advertencia si está vacío)
        if (!frame || !slot || !port) return "";
        return `${frame}/${slot}/${port}`;
    }

    function isFullBox(boxText) {
        if (!boxText) return false;
        if (FULL_BOXES_EXACT.has(boxText)) return true;
        return FULL_BOX_RULES.some((rule) => {
            try { return rule(boxText); } catch { return false; }
        });
    }

    function isFullPon(ponStr) {
        if (!ponStr) return false;
        return FULL_PONS.has(ponStr);
    }

    function maybeWarnFull() {
        const boxText = getSelectedBoxText();
        const ponStr = getPonString();

        const fullByBox = isFullBox(boxText);
        const fullByPon = isFullPon(ponStr);

        // Solo mostrar advertencia cuando realmente detecta "lleno"
        if (!fullByBox && !fullByPon) return;

        // Construir mensaje
        const reasons = [];
        if (fullByBox) reasons.push(`Caja llena detectada: ${boxText || "(sin caja)"}`);
        if (fullByPon) reasons.push(`PON lleno detectado: ${ponStr}`);

        const msg = `ADVERTENCIA (Wisp Tools)\n\n${reasons.join("\n")}`;

        // Clave para evitar repetir la misma advertencia
        const key = `${boxText}||${ponStr}||${fullByBox}||${fullByPon}`;
        if (shownWarnings.has(key)) return;
        shownWarnings.add(key);

        alert(msg);
    }

    function setupFullDetectors() {
        // 1) Cuando cambia la caja
        const boxSel = document.getElementById("select_box");
        if (boxSel) {
            boxSel.addEventListener("change", maybeWarnFull);
            // por si ya está seleccionada al cargar
            setTimeout(maybeWarnFull, 500);
        }

        // 2) Cuando cambia el PON (inputs)
        const ids = ["frame_fiber_register", "slot_fiber_register", "port_fiber_register"];
        for (const id of ids) {
            const el = document.getElementById(id);
            if (!el) continue;
            el.addEventListener("input", maybeWarnFull);
            el.addEventListener("change", maybeWarnFull);
        }
    }

    // Esperar un poco por si la página carga el formulario tarde
    setTimeout(setupFullDetectors, 800);

    // =========================
    // BOTONES
    // =========================

    document.getElementById("wisp-refresh").onclick = () => {
        location.reload();
    };

    document.getElementById("wisp-copy").onclick = () => {
        const text = window.getSelection().toString();
        if (text) {
            navigator.clipboard.writeText(text);
            alert("Copiado: " + text);
        } else {
            alert("Selecciona un nombre o texto primero.");
        }
    };

})();
