// ==UserScript==
// @name         WME LT jm6087 test
// @namespace    https://github.com/SkiDooGuy/WME-LaneTools-Dev
// @version      2023.03.16.00
// @description  Adds highlights and tools to WME to supplement the lanes feature
// @author       SkiDooGuy, Click Saver by HBiede, Heuristics by kndcajun
// @updateURL    https://github.com/SkiDooGuy/WME-LaneTools-Dev/raw/master/LaneTools.user.js
// @downloadURL  https://github.com/SkiDooGuy/WME-LaneTools-Dev/raw/master/LaneTools.user.js
// @match        https://www.waze.com/editor*
// @match        https://www.waze.com/*/editor*
// @match        https://beta.waze.com/editor*
// @match        https://beta.waze.com/*/editor*
// @exclude      https://www.waze.com/user/editor*
// @require      https://greasyfork.org/scripts/24851-wazewrap/code/WazeWrap.js
// @grant        none
// @contributionURL https://github.com/WazeDev/Thank-The-Authors
// ==/UserScript==

/* global W */
/* global WazeWrap */
/* global $ */
/* global OpenLayers */
/* global _ */
/* global require */

const LANETOOLS_VERSION = `${GM_info.script.version}`;
const GF_LINK = 'https://github.com/SkiDooGuy/WME-LaneTools/blob/master/WME-LaneTools.user.js';
const FORUM_LINK = 'https://www.waze.com/forum/viewtopic.php?f=819&t=301158';
const LI_UPDATE_NOTES = `<b>NEW:</b><br>
<b>FIXES:</b><br><br>
- DISABLED Auto-expand lanes<br>
- to stop the issue with flickering<br>`;

const LANETOOLS_DEBUG_LEVEL = 1;
const configArray = {};
const RBSArray = { failed: false };
const IsBeta = location.href.indexOf('beta.waze.com') !== -1;
const TRANSLATIONS = {
    // Default english values
    default: {
        enabled: 'Enabled',
        disabled: 'Disabled',
        toggleShortcut: 'Toggle Shortcut',
        UIEnhance: 'Tab UI Enhancements',
        autoWidth: 'Auto-open road width',
        autoOpen: 'Auto-open lanes tab',
        autoExpand: 'Auto-expand lane editor',
        autoFocus: 'Auto-focus lane input',
        reOrient: 'Re-orient lane icons',
        enClick: 'Enable ClickSaver',
        clickStraight: 'All straight lanes',
        clickTurn: 'Turn lanes',
        mapHighlight: 'Map Highlights',
        laneLabel: 'Lane labels',
        nodeHigh: 'Node highlights',
        LAOHigh: 'Lane angle overrides',
        CSOHigh: 'Continue straight overrides',
        heuristics: 'Lane heuristics candidates',
        posHeur: 'Positive heuristics candidate',
        negHeur: 'Negative heuristics candidate',
        highColor: 'Highlight Colors',
        colTooltip: 'Click to toggle color inputs',
        selAllTooltip: 'Click on turn name to toggle all lane associations',
        fwdCol: 'Fwd (A>B)',
        revCol: 'Rev (B>A)',
        labelCol: 'Labels',
        errorCol: 'Lane errors',
        laneNodeCol: 'Nodes with lanes',
        nodeTIOCol: 'Nodes with TIOs',
        LAOCol: 'Segs with TIOs',
        viewCSCol: 'View only CS',
        hearCSCol: 'View and hear CS',
        heurPosCol: 'Lane heuristics likely',
        heurNegCol: 'Lane heuristics - not qualified',
        advTools: 'Advanced Tools',
        quickTog: 'Quick toggle all lanes',
        showRBS: 'Use RBS heuristics',
        delFwd: 'Delete FWD Lanes',
        delRev: 'Delete Rev Lanes',
        delOpp: 'This segment is one-way but has lanes set in the opposite direction. Click here to delete them',
        csIcons: 'Highlight CS Icons',
        highlightOverride: 'Only highlight if segment layer active',
        addTIO: 'Include TIO in lanes tab',
        labelTIO: 'TIO',
        defaultTIO: 'Waze Selected',
        noneTIO: 'None',
        tlTIO: 'Turn Left',
        trTIO: 'Turn Right',
        klTIO: 'Keep Left',
        krTIO: 'Keep Right',
        conTIO: 'Continue',
        elTIO: 'Exit Left',
        erTIO: 'Exit Right',
        uturnTIO: 'U-Turn',
        enIcons: 'Display lane icons on map',
        IconsRotate: 'Rotate map icons with segment direction'
    }
};
const Direction = {
    REVERSE: -1,
    ANY: 0,
    FORWARD: 1
};
const LT_ROAD_TYPE = {
    // Streets
    NARROW_STREET: 22,
    STREET: 1,
    PRIMARY_STREET: 2,
    // Highways
    RAMP: 4,
    FREEWAY: 3,
    MAJOR_HIGHWAY: 6,
    MINOR_HIGHWAY: 7,
    // Other drivable
    DIRT_ROAD: 8,
    FERRY: 14,
    PRIVATE_ROAD: 17,
    PARKING_LOT_ROAD: 20,
    // Non-drivable
    WALKING_TRAIL: 5,
    PEDESTRIAN_BOARDWALK: 10,
    STAIRWAY: 16,
    RAILROAD: 18,
    RUNWAY: 19
};
const DisplayLevels = {
    MIN_ZOOM_ALL: 14,
    MIN_ZOOM_NONFREEWAY: 17
};
const HeuristicsCandidate = {
    ERROR: -2,
    FAIL: -1,
    NONE: 0,
    PASS: 1
};

let MAX_LEN_HEUR; // Maximum length of segment where lane heuristics applied (Specified in Wiki).
let MAX_PERP_DIF; // Updated 2020-09, based on experiments
let MAX_PERP_DIF_ALT; // New 2020-09, based on experiments
let MAX_PERP_TO_CONSIDER; // Don't even consider perp angles outside of this tolerance
let MAX_STRAIGHT_TO_CONSIDER; // Don't even consider straight angles inside of this tolerance
let MAX_STRAIGHT_DIF; // IN TESTING;  updated 2020-09
let lt_scanArea_recursive = 0;
let LtSettings = {};
let strings = {};
let _turnInfo = [];
let _turnData = {};
let laneCount;
let LTHighlightLayer;
let LTNamesLayer;
let LTLaneGraphics;
let _pickleColor;
let seaPickle;
let UpdateObj;
let MultiAction;
let SetTurn;
let shortcutsDisabled = false; 
let isRBS = false;
let allowCpyPst = false;
let langLocality = 'default';
let UPDATEDZOOM;

console.log('LaneTools: initializing...');

function laneToolsBootstrap(tries = 0) {
    if (window.W && window.W.map && window.W.model && window.W.loginManager.user && $ && WazeWrap.Ready) {
        initLaneTools();
    } else if (tries < 500) {
        setTimeout(() => {
            laneToolsBootstrap(tries + 1);
        }, 200);
    } else {
        console.error('LaneTools: Failed to load');
    }
}

function initLaneTools() {
    seaPickle = W.loginManager.user;
    UpdateObj = require('Waze/Action/UpdateObject');
    MultiAction = require('Waze/Action/MultiAction');
    SetTurn = require('Waze/Model/Graph/Actions/SetTurn');
    UPDATEDZOOM = W.map.getOLMap().getNumZoomLevels() === 23;

    const ltCss = [
        '.lt-wrapper {position:relative;width:100%;font-size:12px;font-family:"Rubik", "Boing-light", sans-serif;user-select:none;}',
        '.lt-section-wrapper {display:block;width:100%;padding:4px;}',
        '.lt-section-wrapper.border {border-bottom:1px solid grey;margin-bottom:5px;}',
        '.lt-option-container {padding:3px;}',
        '.lt-option-container.color {text-decoration:none;}',
        'input[type="checkbox"].lt-checkbox {position:relative;top:3px;vertical-align:top;margin:0;}',
        'input[type="text"].lt-color-input {position:relative;width:70px;padding:3px;border:2px solid black;border-radius:6px;}',
        'input[type="text"].lt-color-input:focus {outline-width:0;}',
        'label.lt-label {position:relative;max-width:90%;font-weight:normal;padding-left:5px}',
        '.lt-Toolbar-Container {display:none;position:absolute;background-color:orange;border-radius:6px;border:1.5px solid;box-size:border-box;z-index:1050;}',
        '.lt-Toolbar-Wrapper {position:relative;padding:3px;}',
        '.lt-toolbar-button-container {display:inline-block;padding:5px;}',
        '.lt-toolbar-button {position:relative;display:block;width:60px;height:25px;border-radius:6px;font-size:12px;}',
        '.lt-add-Width {display:inline-block;width:15px;height:15px;border:1px solid black;border-radius:8px;margin:0 3px 0 3px;line-height: 1.5;text-align:center;font-size:10px;}',
        '.lt-add-Width:hover {border:1px solid #26bae8;background-color:#26bae8;cursor:pointer;}',
        '.lt-add-lanes {display:inline-block;width:15px;height:15px;border:1px solid black;border-radius:8px;margin:0 3px 0 3px;line-height: 1.5;text-align:center;font-size:10px;}',
        '.lt-add-lanes:hover {border:1px solid #26bae8;background-color:#26bae8;cursor:pointer;}',
        '.lt-chkAll-lns {display:inline-block;width:20px;height:20px;text-decoration:underline;font-weight:bold;font-size:10px;padding-left:3px;cursor:pointer;}',
        '.lt-tio-select {max-width:80%;color:rgb(32, 33, 36);background-color:rgb(242, 243, 244);border:0px;border-radius:6px;padding:0 16px 0 10px;cursor:pointer;}',
        '#lt-color-title {display:block;width:100%;padding:5px 0 5px 0;font-weight:bold;text-decoration:underline;cursor:pointer;}'
    ].join(' ');

    const $ltTab = $('<div>');
    $ltTab.html = ([
        `<div class='lt-wrapper' id='lt-tab-wrapper'>
            <div class='lt-section-wrapper' id='lt-tab-body'>
                <div class='lt-section-wrapper border' style='border-bottom:2px double grey;'>
                    <a href='https://www.waze.com/forum/viewtopic.php?f=819&t=301158' style='font-weight:bold;font-size:12px;text-decoration:underline;'  target='_blank'>LaneTools - v${LANETOOLS_VERSION}</a>
                    <div>
                        <div style='display:inline-block;'><span class='lt-trans-tglshcut'></span>:<span id='lt-EnableShortcut' style='padding-left:10px;'></span></div>
                        <div class='lt-option-container' style='float:right;'>
                            <input type=checkbox class='lt-checkbox' id='lt-ScriptEnabled' />
                            <label class='lt-label' for='lt-ScriptEnabled'><span class='lt-trans-enabled'></span></label>
                        </div>
                    </div>
                </div>
                <div class='lt-section-wrapper' id='lt-LaneTabFeatures'>
                    <div class='lt-section-wrapper border'>
                        <span style='font-weight:bold;'><span id='lt-trans-uiEnhance'></span></span>
                        <div class='lt-option-container' style='float:right;'>
                            <input type=checkbox class='lt-checkbox' id='lt-UIEnable' />
                            <label class='lt-label' for='lt-UIEnable'><span class='lt-trans-enabled'></span></label>
                        </div>
                    </div>
                    <div id='lt-UI-wrapper'>
                        <div class='lt-option-container' style='margin-bottom:5px;'>
                            <div style='display:inline-block;'><span class='lt-trans-tglshcut'></span>:<span id='lt-UIEnhanceShortcut' style='padding-left:10px;'></span></div>
                        </div>
                        <div class='lt-option-container'>
                            <input type=checkbox class='lt-checkbox' id='lt-AutoOpenWidth' />
                            <label class='lt-label' for='lt-AutoOpenWidth'><span id='lt-trans-autoWidth'></span></label>
                        </div>
                        <div class='lt-option-container'>
                            <input type=checkbox class='lt-checkbox' id='lt-AutoLanesTab' />
                            <label class='lt-label' for='lt-AutoLanesTab'><span id='lt-trans-autoTab'></span></label>
                        </div>
                        <div class='lt-option-container'>
                            <input type=checkbox class='lt-checkbox' id='lt-AutoExpandLanes' />
                            <label class='lt-label' for='lt-AutoExpandLanes'><span title="Feature disabled as of Aug 27, 2022 to prevent flickering issue" id='lt-trans-autoExpand'></span></label>
                        </div>
                        <div class='lt-option-container'>
                            <input type=checkbox class='lt-checkbox' id='lt-AutoFocusLanes' />
                            <label class='lt-label' for='lt-AutoFocusLanes'><span id='lt-trans-autoFocus'></span></label>
                        </div>
                        <div class='lt-option-container'>
                            <input type=checkbox class='lt-checkbox' id='lt-highlightCSIcons' />
                            <label class='lt-label' for='lt-highlightCSIcons'><span id='lt-trans-csIcons'></span></label>
                        </div>
                        <div class='lt-option-container'>
                            <input type=checkbox class='lt-checkbox' id='lt-ReverseLanesIcon' />
                            <label class='lt-label' for='lt-ReverseLanesIcon'><span id='lt-trans-orient'></span></label>
                        </div>
                        <div class='lt-option-container' style='display:none;'>
                            <input type=checkbox class='lt-checkbox' id='lt-AddTIO' />
                            <label class='lt-label' for='lt-AddTIO'><span id='lt-trans-AddTIO'></span></label>
                        </div>
                        <div class='lt-option-container'>
                            <input type=checkbox class='lt-checkbox' id='lt-ClickSaveEnable' />
                            <label class='lt-label' for='lt-ClickSaveEnable'><span id='lt-trans-enClick'></span></label>
                        </div>
                        <div class='lt-option-container clk-svr' style='padding-left:10%;'>
                            <input type=checkbox class='lt-checkbox' id='lt-ClickSaveStraight' />
                            <label class='lt-label' for='lt-ClickSaveStraight'><span id='lt-trans-straClick'></span></label>
                        </div>
                        <div class='lt-option-container clk-svr' style='padding-left:10%;'>
                            <input type=checkbox class='lt-checkbox' id='lt-ClickSaveTurns' />
                            <label class='lt-label' for='lt-ClickSaveTurns'><span id='lt-trans-turnClick'></span></label>
                        </div>
                    </div>
                </div>
                <div class='lt-section-wrapper'>
                    <div class='lt-section-wrapper border'>
                        <span style='font-weight:bold;'><span id='lt-trans-mapHigh'></span></span>
                        <div class='lt-option-container' style='float:right;'>
                            <input type=checkbox class='lt-checkbox' id='lt-HighlightsEnable' />
                            <label class='lt-label' for='lt-HighlightsEnable'><span class='lt-trans-enabled'></span></label>
                        </div>
                    </div>
                    <div id='lt-highlights-wrapper'>
                        <div class='lt-option-container' style='margin-bottom:5px;'>
                            <div style='display:inline-block;'><span class='lt-trans-tglshcut'></span>:<span id='lt-HighlightShortcut' style='padding-left:10px;'></span></div>
                        </div>
                        <div class='lt-option-container'>
                            <input type=checkbox class='lt-checkbox' id='lt-IconsEnable' />
                            <label class='lt-label' for='lt-IconsEnable'><span id='lt-trans-enIcons'></span></label>
                        </div>
                        <div class='lt-option-container'>
                            <input type=checkbox class='lt-checkbox' id='lt-IconsRotate' />
                            <label class='lt-label' for='lt-IconsRotate'><span id='lt-trans-IconsRotate'></span></label>
                        </div>
                        <div class='lt-option-container'>
                            <input type=checkbox class='lt-checkbox' id='lt-LabelsEnable' />
                            <label class='lt-label' for='lt-LabelsEnable'><span id='lt-trans-lnLabel'></span></label>
                        </div>
                        <div class='lt-option-container'>
                            <input type=checkbox class='lt-checkbox' id='lt-NodesEnable' />
                            <label class='lt-label' for='lt-NodesEnable'><span id='lt-trans-nodeHigh'></span></label>
                        </div>
                        <div class='lt-option-container'>
                            <input type=checkbox class='lt-checkbox' id='lt-LIOEnable' />
                            <label class='lt-label' for='lt-LIOEnable'><span id='lt-trans-laOver'></span></label>
                        </div>
                        <div class='lt-option-container'>
                            <input type=checkbox class='lt-checkbox' id='lt-CSEnable' />
                            <label class='lt-label' for='lt-CSEnable'><span id='lt-trans-csOver'></span></label>
                        </div>
                        <div class='lt-option-container'>
                            <input type=checkbox class='lt-checkbox' id='lt-highlightOverride' />
                            <label class='lt-label' for='lt-highlightOverride'><span id='lt-trans-highOver'></span></label>
                        </div>
                    </div>
                </div>
                <div class='lt-section-wrapper'>
                    <div class='lt-section-wrapper border'>
                        <span style='font-weight:bold;'><span id='lt-trans-heurCan'></span></span>
                        <div class='lt-option-container' style='float:right;'>
                            <input type=checkbox class='lt-checkbox' id='lt-LaneHeuristicsChecks' />
                            <label class='lt-label' for='lt-LaneHeuristicsChecks'><span class='lt-trans-enabled'></span></label>
                        </div>
                    </div>
                    <div id='lt-heur-wrapper'>
                        <div class='lt-option-container' style='margin-bottom:5px;'>
                            <div style='display:inline-block;'><span class='lt-trans-tglshcut'></span>:<span id='lt-LaneHeurChecksShortcut' style='padding-left:10px;'></span></div>
                        </div>
                        <div class='lt-option-container'>
                            <input type=checkbox class='lt-checkbox' id='lt-LaneHeurPosHighlight' />
                            <label class='lt-label' for='lt-LaneHeurPosHighlight'><span id='lt-trans-heurPos'></span></label>
                        </div>
                        <div class='lt-option-container'>
                            <input type=checkbox class='lt-checkbox' id='lt-LaneHeurNegHighlight' />
                            <label class='lt-label' for='lt-LaneHeurNegHighlight'><span id='lt-trans-heurNeg'></span></label>
                        </div>
                    </div>
                </div>
                <div class='lt-section-wrapper'>
                    <div class='lt-section-wrapper'>
                        <span id='lt-color-title' data-original-title='${TRANSLATIONS[langLocality].colTooltip}'><span id='lt-trans-highCol'></span>:</span>
                        <div id='lt-color-inputs' style='display:none;'>
                            <div class='lt-option-container color'>
                                <input type=color class='lt-color-input' id='lt-ABColor' />
                                <label class='lt-label' for='lt-ABColor' id='lt-ABColorLabel'><span id='lt-trans-fwdCol'></span></label>
                            </div>
                            <div class='lt-option-container color'>
                                <input type=color class='lt-color-input' id='lt-BAColor' />
                                <label class='lt-label' for='lt-BAColor' id='lt-BAColorLabel'><span id='lt-trans-revCol'></span></label>
                            </div>
                            <div class='lt-option-container color'>
                                <input type=color class='lt-color-input' id='lt-LabelColor' />
                                <label class='lt-label' for='lt-LabelColor' id='lt-LabelColorLabel'><span id='lt-trans-labelCol'></span></label>
                            </div>
                            <div class='lt-option-container color'>
                                <input type=color class='lt-color-input' id='lt-ErrorColor' />
                                <label class='lt-label' for='lt-ErrorColor' id='lt-ErrorColorLabel'><span id='lt-trans-errorCol'></span></label>
                            </div>
                            <div class='lt-option-container color'>
                                <input type=color class='lt-color-input' id='lt-NodeColor' />
                                <label class='lt-label' for='lt-NodeColor' id='lt-NodeColorLabel'><span id='lt-trans-nodeCol'></span></label>
                            </div>
                            <div class='lt-option-container color'>
                                <input type=color class='lt-color-input' id='lt-TIOColor' />
                                <label class='lt-label' for='lt-TIOColor' id='lt-TIOColorLabel'><span id='lt-trans-tioCol'></span></label>
                            </div>
                            <div class='lt-option-container color'>
                                <input type=color class='lt-color-input' id='lt-LIOColor' />
                                <label class='lt-label' for='lt-TIOColor' id='lt-LIOColorLabel'><span id='lt-trans-laoCol'></span></label>
                            </div>
                            <div class='lt-option-container color'>
                                <input type=color class='lt-color-input' id='lt-CS1Color' />
                                <label class='lt-label' for='lt-CS1Color' id='lt-CS1ColorLabel'><span id='lt-trans-viewCol'></span></label>
                            </div>
                            <div class='lt-option-container color'>
                                <input type=color class='lt-color-input' id='lt-CS2Color' />
                                <label class='lt-label' for='lt-CS2Color' id='lt-CS2ColorLabel'><span id='lt-trans-hearCol'></span></label>
                            </div>
                            <div class='lt-option-container color'>
                                <input type=color class='lt-color-input' id='lt-HeurColor' />
                                <label class='lt-label' for='lt-HeurColor' id='lt-HeurColorLabel'><span id='lt-trans-posCol'></span></label>
                            </div>
                            <div class='lt-option-container color'>
                                <input type=color class='lt-color-input' id='lt-HeurFailColor' />
                                <label class='lt-label' for='lt-HeurFailColor' id='lt-HeurFailColorLabel'><span id='lt-trans-negCol'></span></label>
                            </div>
                        </div>
                    </div>
                </div>
                <div class='lt-section-wrapper' id='lt-adv-tools' style='display:none;'>
                    <div class='lt-section-wrapper border'>
                        <span style='font-weight:bold;'><span id='lt-trans-advTools'>></span></span>
                    </div>
                    <div class='lt-option-container'>
                        <input type=checkbox class='lt-checkbox' id='lt-SelAllEnable' />
                        <label class='lt-label' for='lt-SelAllEnable' ><span id='lt-trans-quickTog'></span></label>
                    </div>
                    <div class='lt-option-container' id='lt-serverSelectContainer' style='display:none;'>
                        <input type=checkbox class='lt-checkbox' id='lt-serverSelect' />
                        <label class='lt-label' for='lt-serverSelect'><span id='lt-trans-heurRBS'></span></label>
                    </div>
                    <div class='lt-option-container' id='lt-cpy-pst' style='display:none;'>
                        <input type=checkbox class='lt-checkbox' id='lt-CopyEnable' />
                        <label class='lt-label' for='lt-CopyEnable'>Copy/Paste Lanes</label>
                        <span style='font-weight: bold;'>(**Caution** - double check results, feature still in Dev)</span>
                    </div>
                    <div id='lt-sheet-link' style='display:none;'>
                        <a href='https://docs.google.com/spreadsheets/d/1_3sF09sMOid_us37j5CQqJZlBGGr1vI_3Rrmp5K-KCQ/edit?usp=sharing' target='_blank'>LT Config Sheet</a>
                    </div>
                </div>
            </div>
        </div>`
    ].join(' '));

    const $ltButtons = $('<div>');
    $ltButtons.html([
        `<div class='lt-Toolbar-Container' id="lt-toolbar-container">
            <div class='lt-Toolbar-Wrapper'>
                <div class='lt-toolbar-button-container'>
                    <button type='button' class='lt-toolbar-button' id='copyA-button'>Copy A</button>
                </div>
                <div class='lt-toolbar-button-container'>
                    <button type='button' class='lt-toolbar-button' id='copyB-button'>Copy B</button>
                </div>
                <div class='lt-toolbar-button-container'>
                    <button type='button' class='lt-toolbar-button' id='pasteA-button'>Paste A</button>
                </div>
                <div class='lt-toolbar-button-container'>
                    <button type='button' class='lt-toolbar-button' id='pasteB-button'>Paste B</button>
                </div>
            </div>
        </div>`
    ].join(' '));

    seaPickle = W.loginManager.user;
    _pickleColor = seaPickle.rank;
    let proceedReady = _pickleColor >= 0;

    if (proceedReady) {
        WazeWrap.Interface.Tab('LT', $ltTab.html, setupOptions, 'LT');
        $(`<style type="text/css">${ltCss}</style>`).appendTo('head');
        $('#map').append($ltButtons.html());
        WazeWrap.Interface.ShowScriptUpdate(GM_info.script.name, GM_info.script.version, LI_UPDATE_NOTES, GF_LINK, FORUM_LINK);
        console.log('LaneTools: loaded');
    } else {
        console.error('LaneTools: loading error....');
    }
}

async function setupOptions() {
    function setOptionStatus() {
        // Set check boxes based on last use
        setChecked('lt-ScriptEnabled', LtSettings.ScriptEnabled);
        setChecked('lt-UIEnable', LtSettings.UIEnable);
        setChecked('lt-AutoOpenWidth', LtSettings.AutoOpenWidth);
        setChecked('lt-AutoExpandLanes', LtSettings.AutoExpandLanes);
        setChecked('lt-AutoLanesTab', LtSettings.AutoLanesTab);
        setChecked('lt-HighlightsEnable', LtSettings.HighlightsEnable);
        setChecked('lt-LabelsEnable', LtSettings.LabelsEnable);
        setChecked('lt-NodesEnable', LtSettings.NodesEnable);
        setChecked('lt-LIOEnable', LtSettings.LIOEnable);
        setChecked('lt-CSEnable', LtSettings.CSEnable);
        setChecked('lt-highlightOverride', LtSettings.highlightOverride);
        setChecked('lt-CopyEnable', LtSettings.CopyEnable);
        setChecked('lt-SelAllEnable', LtSettings.SelAllEnable);
        setChecked('lt-serverSelect', LtSettings.serverSelect);
        setChecked('lt-AutoFocusLanes', LtSettings.AutoFocusLanes);
        setChecked('lt-ReverseLanesIcon', LtSettings.ReverseLanesIcon);
        setChecked('lt-ClickSaveEnable', LtSettings.ClickSaveEnable);
        setChecked('lt-ClickSaveStraight', LtSettings.ClickSaveStraight);
        setChecked('lt-ClickSaveTurns', LtSettings.ClickSaveTurns);
        setChecked('lt-LaneHeurPosHighlight', LtSettings.LaneHeurPosHighlight);
        setChecked('lt-LaneHeurNegHighlight', LtSettings.LaneHeurNegHighlight);
        setChecked('lt-LaneHeuristicsChecks', LtSettings.LaneHeuristicsChecks);
        setChecked('lt-highlightCSIcons', LtSettings.highlightCSIcons);
        setChecked('lt-AddTIO', LtSettings.AddTIO);
        setChecked('lt-IconsEnable', LtSettings.IconsEnable);
        setChecked('lt-IconsRotate', LtSettings.IconsRotate);

        setValue('lt-ABColor', LtSettings.ABColor);
        setValue('lt-BAColor', LtSettings.BAColor);
        setValue('lt-LabelColor', LtSettings.LabelColor);
        setValue('lt-ErrorColor', LtSettings.ErrorColor);
        setValue('lt-NodeColor', LtSettings.NodeColor);
        setValue('lt-TIOColor', LtSettings.TIOColor);
        setValue('lt-LIOColor', LtSettings.LIOColor);
        setValue('lt-CS1Color', LtSettings.CS1Color);
        setValue('lt-CS2Color', LtSettings.CS2Color);
        setValue('lt-HeurColor', LtSettings.HeurColor);
        setValue('lt-HeurFailColor', LtSettings.HeurFailColor);

        if (!getId('lt-ClickSaveEnable').checked) {
            $('.lt-option-container.clk-svr').hide();
        }

        if (!getId('lt-UIEnable').checked) {
            $('#lt-UI-wrapper').hide();
        }

        if (!getId('lt-HighlightsEnable').checked) {
            $('#lt-highlights-wrapper').hide();
        }

        if (!getId('lt-LaneHeuristicsChecks').checked) {
            $('#lt-heur-wrapper').hide();
        }

        function setChecked(checkboxId, checked) {
            $(`#${checkboxId}`).prop('checked', checked);
        }

        function setValue(inputId, color) {
            const inputElem = $(`#${inputId}`);
            inputElem.attr('value', color);
            inputElem.css('border', `2px solid ${color}`);
        }
    }

    await loadSettings();
    await loadSpreadsheet();
    initLaneGuidanceClickSaver();

    // Layer for highlights
    LTHighlightLayer = new OpenLayers.Layer.Vector('LTHighlightLayer', { uniqueName: '_LTHighlightLayer' });
    W.map.addLayer(LTHighlightLayer);
    LTHighlightLayer.setVisibility(true);

    // Layer for future use of lane association icons...
    LTLaneGraphics = new OpenLayers.Layer.Vector('LTLaneGraphics', { uniqueName: 'LTLaneGraphics' });
    W.map.addLayer(LTLaneGraphics);
    LTLaneGraphics.setVisibility(true);

    // Layer for lane text
    const namesStyle = new OpenLayers.Style({
        fontFamily: 'Open Sans, Alef, helvetica, sans-serif, monospace',
        labelOutlineColor: 'black',
        fontColor: '${labelColor}',
        fontSize: '16',
        labelXOffset: 15,
        labelYOffset: -15,
        labelOutlineWidth: '3',
        label: '${labelText}',
        angle: '',
        labelAlign: 'cm',
        'stroke-width': '0'
    });
    LTNamesLayer = new OpenLayers.Layer.Vector('LTNamesLayer', {
        uniqueName: 'LTNamesLayer',
        styleMap: new OpenLayers.StyleMap(namesStyle)
    });
    W.map.addLayer(LTNamesLayer);
    LTNamesLayer.setVisibility(true);

    // Add event listers
    WazeWrap.Events.register('moveend', null, scanArea);
    WazeWrap.Events.register('moveend', null, displayLaneGraphics);
    WazeWrap.Events.register('zoomend', null, scanArea);
    WazeWrap.Events.register('zoomend', null, displayLaneGraphics);
    WazeWrap.Events.register('afteraction', null, scanArea);
    WazeWrap.Events.register('afteraction', null, lanesTabSetup);
    WazeWrap.Events.register('afteraction', null, displayLaneGraphics);
    WazeWrap.Events.register('afterundoaction', null, scanArea);
    WazeWrap.Events.register('afterundoaction', null, lanesTabSetup);
    WazeWrap.Events.register('afterundoaction', null, displayLaneGraphics);
    WazeWrap.Events.register('afterclearactions', null, scanArea);
    WazeWrap.Events.register('selectionchanged', null, scanArea);
    WazeWrap.Events.register('selectionchanged', null, lanesTabSetup);
    WazeWrap.Events.register('selectionchanged', null, displayLaneGraphics);
    WazeWrap.Events.register('changelayer', null, scanArea);

    // Add keyboard shortcuts
    try {
        new WazeWrap.Interface.Shortcut('enableHighlights', 'Toggle lane highlights', 'wmelt', 'Lane Tools', LtSettings.enableHighlights, toggleHighlights, null).add();
        new WazeWrap.Interface.Shortcut('enableUIEnhancements', 'Toggle UI enhancements', 'wmelt', 'Lane Tools', LtSettings.enableUIEnhancements, toggleUIEnhancements, null).add();
        new WazeWrap.Interface.Shortcut('enableHeuristics', 'Toggle heuristic highlights', 'wmelt', 'Lane Tools', LtSettings.enableHeuristics, toggleLaneHeuristicsChecks, null).add();
        new WazeWrap.Interface.Shortcut('enableScript', 'Toggle script', 'wmelt', 'Lane Tools', LtSettings.enableScript, toggleScript, null).add();
    } catch(e) {
        console.log(`LT: Error creating shortcuts. This feature will be disabled.`);

        $('#lt-EnableShortcut').text(`${TRANSLATIONS.default.disabled}`);
        $('#lt-HighlightShortcut').text(`${TRANSLATIONS.default.disabled}`);
        $('#lt-UIEnhanceShortcut').text(`${TRANSLATIONS.default.disabled}`);
        $('#lt-LaneHeurChecksShortcut').text(`${TRANSLATIONS.default.disabled}`);

        shortcutsDisabled = true;
    }

    // Setup user options now that the settings are loaded
    const highlights = $('#lt-HighlightsEnable');
    const colorTitle = $('#lt-color-title');
    const heurChecks = $('#lt-LaneHeuristicsChecks');

    setOptionStatus();
    setTimeout(() => {
        updateShortcutLabels();
    }, 50);
    setHeuristics();
    setTranslations();

    if (_pickleColor > 1) {
        let featureList = 'LaneTools: The following special access features are enabled: ';
        $('#lt-adv-tools').css('display', 'block');
        $('#lt-trans-quickTog').attr('data-original-title', `${strings.selAllTooltip}`);
        $('#lt-trans-quickTog').tooltip();
        _.each(RBSArray, u => {
            if (u[0] === seaPickle.userName) {
                if (u[1] === '1') {
                    isRBS = true;
                }
                if (u[2] === '1') {
                    allowCpyPst = true;
                }
            }
        });
        if (isRBS) {
            $('#lt-serverSelectContainer').css('display', 'block');
            featureList += 'RBS Heuristics';
        }
        if (allowCpyPst) {
            $('#lt-sheet-link').css({
                display: 'block',
                margin: '2px'
            });
            $('#lt-sheet-link > a').css({
                padding: '2px',
                border: '2px solid black',
                'border-radius': '6px',
                'text-decoration': 'none'
            });
            $('#lt-sheet-link > a').hover(function () {
                $(this).css('background-color', 'orange');
            }, function () {
                $(this).css('background-color', '#eeeeee');
            });
            // $('#lt-cpy-pst').css('display', 'block');
            // $('.lt-Toolbar-Container').draggable({ containment: 'parent', zIndex: '100' });
            // WazeWrap.Events.register('selectionchanged', null, displayToolbar);
            $('.lt-toolbar-button').click(function () {
                if ($(this)[0].id === 'copyA-button') {
                    copyLaneInfo('A');
                }
                if ($(this)[0].id === 'copyB-button') {
                    copyLaneInfo('B');
                }
                if ($(this)[0].id === 'pasteA-button') {
                    pasteLaneInfo('A');
                }
                if ($(this)[0].id === 'pasteB-button') {
                    pasteLaneInfo('B');
                }
            });
            featureList = isRBS ? `${featureList}, Copy/Paste` : `${featureList}Copy/Paste`;
        }
        if (isRBS || allowCpyPst) {
            console.log(featureList);
        }
    } else {
        $('#lt-LaneTabFeatures').css('display', 'none');
    }

    $('.lt-checkbox').click(function () {
        let settingName = $(this)[0].id.substr(3);
        LtSettings[settingName] = this.checked;
        saveSettings();
    });
    $('.lt-color-input').change(function () {
        let settingName = $(this)[0].id.substr(3);
        LtSettings[settingName] = this.value;
        saveSettings();
        $(`#lt-${settingName}`).css('border', `2px solid ${this.value}`);
        removeHighlights();
        scanArea();
    });
    $('#lt-ScriptEnabled').click(() => {
        if (getId('lt-ScriptEnabled').checked) {
            scanArea();
        } else {
            removeHighlights();
            removeLaneGraphics()
        }
    });
    highlights.click(() => {
        if (getId('lt-HighlightsEnable').checked) {
            scanArea();
        } else {
            removeHighlights();
        }
        scanArea();
    });
    $('#lt-LabelsEnable').click(() => {
        if (getId('lt-LabelsEnable').checked) {
            scanArea();
        } else {
            removeHighlights();
            scanArea();
        }
    });
    $('#lt-NodesEnable').click(() => {
        if (getId('lt-NodesEnable').checked) {
            scanArea();
        } else {
            removeHighlights();
            scanArea();
        }
    });
    $('#lt-LIOEnable').click(() => {
        if (getId('lt-LIOEnable').checked) {
            scanArea();
        } else {
            removeHighlights();
            scanArea();
        }
    });
    $('#lt-IconsEnable').click(() => {
        if (getId('lt-IconsEnable').checked) {
            displayLaneGraphics();
        } else {
            removeLaneGraphics();
        }
    });
    $('#lt-highlightOverride').click(() => {
        if (getId('lt-highlightOverride').checked) {
            scanArea();
        } else {
            removeHighlights();
            scanArea();
        }
    });
    colorTitle.click(() => {
        $('#lt-color-inputs').toggle();
    });
    $('#lt-ClickSaveEnable').click(() => {
        $('.lt-option-container.clk-svr').toggle();
    });
    $('#lt-UIEnable').click(() => {
        $('#lt-UI-wrapper').toggle();
        removeLaneGraphics()
    });
    highlights.click(() => {
        $('#lt-highlights-wrapper').toggle();
    });
    heurChecks.click(() => {
        $('#lt-heur-wrapper').toggle();
    });
    heurChecks.click(() => {
        if (getId('lt-LaneHeuristicsChecks').checked) {
            scanArea();
        } else {
            removeHighlights();
            scanArea();
        }
    });
    $('#lt-LaneHeurPosHighlight').click(() => {
        if (getId('lt-LaneHeurPosHighlight').checked) {
            scanArea();
        } else {
            removeHighlights();
            scanArea();
        }
    });
    $('#lt-LaneHeurNegHighlight').click(() => {
        if (getId('lt-LaneHeurNegHighlight').checked) {
            scanArea();
        } else {
            removeHighlights();
            scanArea();
        }
    });
    $('#lt-serverSelect').click(() => {
        setHeuristics();
        removeHighlights();
        scanArea();
    });

    // Watches for the shortcut dialog to close and updates UI
    const el = $.fn.hide;
    $.fn.hide = function () {
        this.trigger('hide');
        return el.apply(this, arguments);
    };
    $('#keyboard-dialog').on('hide', () => {
        checkShortcutsChanged();
    });

    colorTitle.tooltip();
}

async function loadSettings() {
    const localSettings = $.parseJSON(localStorage.getItem('LT_Settings'));

    const serverSettings = await WazeWrap.Remote.RetrieveSettings('LT_Settings');
    if (!serverSettings) {
        console.error('LaneTools: Error communicating with WW settings server');
    }

    const defaultSettings = {
        lastSaveAction: 0,
        ScriptEnabled: true,
        UIEnable: true,
        AutoOpenWidth: false,
        AutoExpandLanes: false,
        AutoLanesTab: false,
        HighlightsEnable: true,
        LabelsEnable: true,
        NodesEnable: true,
        ABColor: '#990033',
        BAColor: '#0033cc',
        LabelColor: '#FFAD08',
        ErrorColor: '#F50E0E',
        NodeColor: '#66ccff',
        TIOColor: '#ff9900',
        LIOColor: '#ff9900',
        CS1Color: '#04E6F6',
        CS2Color: '#8F47FA',
        HeurColor: '#00aa00',
        HeurFailColor: '#E804F6',
        CopyEnable: false,
        SelAllEnable: false,
        serverSelect: false,
        LIOEnable: true,
        CSEnable: true,
        AutoFocusLanes: true,
        ReverseLanesIcon: false,
        ClickSaveEnable: true,
        ClickSaveStraight: false,
        ClickSaveTurns: true,
        enableScript: '',
        enableHighlights: '',
        enableUIEnhancements: '',
        enableHeuristics: '',
        LaneHeurNegHighlight: false,
        LaneHeurPosHighlight: false,
        LaneHeuristicsChecks: false,
        highlightCSIcons: false,
        highlightOverride: true,
        AddTIO: false,
        IconsEnable: true,
        IconsRotate: true
    };

    LtSettings = $.extend({}, defaultSettings, localSettings);
    if (serverSettings && serverSettings.lastSaveAction > LtSettings.lastSaveAction) {
        $.extend(LtSettings, serverSettings);
        // console.log('LaneTools: server settings used');
    } else {
        // console.log('LaneTools: local settings used');
    }

    // If there is no value set in any of the stored settings then use the default
    Object.keys(defaultSettings).forEach((funcProp) => {
        if (!LtSettings.hasOwnProperty(funcProp)) {
            LtSettings[funcProp] = defaultSettings[funcProp];
        }
    });
}

async function saveSettings() {
    const {
        ScriptEnabled,
        HighlightsEnable,
        LabelsEnable,
        NodesEnable,
        UIEnable,
        AutoLanesTab,
        AutoOpenWidth,
        AutoExpandLanes,
        ABColor,
        BAColor,
        LabelColor,
        ErrorColor,
        NodeColor,
        TIOColor,
        LIOColor,
        CS1Color,
        CS2Color,
        CopyEnable,
        SelAllEnable,
        serverSelect,
        LIOEnable,
        CSEnable,
        AutoFocusLanes,
        ReverseLanesIcon,
        ClickSaveEnable,
        ClickSaveStraight,
        ClickSaveTurns,
        enableScript,
        enableHighlights,
        enableUIEnhancements,
        enableHeuristics,
        HeurColor,
        HeurFailColor,
        LaneHeurPosHighlight,
        LaneHeurNegHighlight,
        LaneHeuristicsChecks,
        highlightCSIcons,
        highlightOverride,
        AddTIO,
        IconsEnable,
        IconsRotate
    } = LtSettings;

    const localSettings = {
        lastSaveAction: Date.now(),
        ScriptEnabled,
        HighlightsEnable,
        LabelsEnable,
        NodesEnable,
        UIEnable,
        AutoOpenWidth,
        AutoLanesTab,
        AutoExpandLanes,
        ABColor,
        BAColor,
        LabelColor,
        ErrorColor,
        NodeColor,
        TIOColor,
        LIOColor,
        CS1Color,
        CS2Color,
        CopyEnable,
        SelAllEnable,
        serverSelect,
        LIOEnable,
        CSEnable,
        AutoFocusLanes,
        ReverseLanesIcon,
        ClickSaveEnable,
        ClickSaveStraight,
        ClickSaveTurns,
        enableScript,
        enableHighlights,
        enableUIEnhancements,
        enableHeuristics,
        HeurColor,
        HeurFailColor,
        LaneHeurPosHighlight,
        LaneHeurNegHighlight,
        LaneHeuristicsChecks,
        highlightCSIcons,
        highlightOverride,
        AddTIO,
        IconsEnable,
        IconsRotate
    };

    // Grab keyboard shortcuts and store them for saving
    for (const name in W.accelerators.Actions) {
        const {shortcut, group} = W.accelerators.Actions[name];
        if (group === 'wmelt') {
            let TempKeys = '';
            if (shortcut) {
                if (shortcut.altKey === true) {
                    TempKeys += 'A';
                }
                if (shortcut.shiftKey === true) {
                    TempKeys += 'S';
                }
                if (shortcut.ctrlKey === true) {
                    TempKeys += 'C';
                }
                if (TempKeys !== '') {
                    TempKeys += '+';
                }
                if (shortcut.keyCode) {
                    TempKeys += shortcut.keyCode;
                }
            } else {
                TempKeys = '-1';
            }
            localSettings[name] = TempKeys;
        }
    }

    // Required for the instant update of changes to the keyboard shortcuts on the UI
    LtSettings = localSettings;

    if (localStorage) {
        localStorage.setItem('LT_Settings', JSON.stringify(localSettings));
    }
    const serverSave = await WazeWrap.Remote.SaveSettings('LT_Settings', localSettings);

    if (serverSave === null) {
        console.warn('LaneTools: User PIN not set in WazeWrap tab');
    } else {
        if (serverSave === false) {
            console.error('LaneTools: Unable to save settings to server');
        }
    }
}

async function loadSpreadsheet() {
    let connected = false;
    const apiKey = 'AIzaSyDZjmkSx5xWc-86hsAIzedgDgRgy8vB7BQ';
    const settingsFailFunc = (jqXHR, textStatus, errorThrown) => {
        console.error('LaneTools: Error loading settings:', errorThrown);
    };
    const rbsFailFunc = (jqXHR, textStatus, errorThrown) => {
        console.error('LaneTools: Error loading RBS:', errorThrown);
        if (!RBSArray.failed) {
            WazeWrap.Alerts.error(GM_info.script.name, 'Unable to load heuristics data for LG. This feature will not be available');
            RBSArray.failed = true;
        }
    };
    const translationsFailFunc = (jqXHR, textStatus, errorThrown) => {
        console.error('LaneTools: Error loading trans:', errorThrown);
    };

    try {
        await $.getJSON(
            `https://sheets.googleapis.com/v4/spreadsheets/1_3sF09sMOid_us37j5CQqJZlBGGr1vI_3Rrmp5K-KCQ/values/Translations!A2:C?key=${apiKey}`
        )
            .done(async (transArray) => {
            if (transArray.values.length > 0) {
                _.each(transArray.values, t => {
                    if (!TRANSLATIONS[t[1]] && Number.parseInt(t[2], 10) === 1) {
                        TRANSLATIONS[t[1]] = JSON.parse(t[0]);
                    }
                });
            } else {
                translationsFailFunc();
            }
        })
            .fail(translationsFailFunc);
    } catch (e) {
        translationsFailFunc(null, null, e);
    }

    try {
        await $.getJSON(
            `https://sheets.googleapis.com/v4/spreadsheets/1_3sF09sMOid_us37j5CQqJZlBGGr1vI_3Rrmp5K-KCQ/values/Angles!A2:B?key=${apiKey}`
        )
            .done((serverSettings) => {
            if (serverSettings.values.length > 0) {
                _.each(serverSettings.values, v => {
                    if (!configArray[v[1]]) {
                        configArray[v[1]] = JSON.parse(v[0]);
                    }
                });
                connected = true;
            } else {
                settingsFailFunc();
            }
        })
            .fail(settingsFailFunc);
    } catch (e) {
        settingsFailFunc(null, null, e);
    }

    try {
        await $.getJSON(
            `https://sheets.googleapis.com/v4/spreadsheets/1_3sF09sMOid_us37j5CQqJZlBGGr1vI_3Rrmp5K-KCQ/values/RBS_Access!A2:C?key=${apiKey}`
        )
            .done((allowedRBS) => {
            if (allowedRBS.values.length > 0) {
                for (let i = 0; i < allowedRBS.values.length; i++) {
                    RBSArray[i] = allowedRBS.values[i];
                }
                RBSArray.failed = false;
            } else {
                rbsFailFunc();
            }
        })
            .fail(rbsFailFunc);
    } catch (e) {
        rbsFailFunc(null, null, e);
    }

    if (connected) {
        _.each(configArray, serverKey => {
            for (const k in serverKey) {
                if (serverKey.hasOwnProperty(k)) {
                    let keyValue = serverKey[k];
                    serverKey[k] = Number.parseFloat(keyValue);
                }
            }
        });
    }
}

function setTranslations() {
    langLocality = I18n.currentLocale().toLowerCase();
    if (TRANSLATIONS[langLocality]) {
        strings = TRANSLATIONS[langLocality];
    } else if (langLocality.includes('-') && TRANSLATIONS[langLocality.split('-')[0]]) {
        strings = TRANSLATIONS[langLocality.split('-')[0]];
    } else {
        strings = TRANSLATIONS.default;
    }

    // If there is no value set in any of the translated strings then use the defaults
    Object.keys(TRANSLATIONS.default).forEach((transString) => {
        if (!strings.hasOwnProperty(transString) || strings[transString] == "") {
            strings[transString] = TRANSLATIONS.default[transString];
        }
    });

    $('.lt-trans-enabled').text(strings.enabled);
    $('.lt-trans-tglshcut').text(strings.toggleShortcut);
    $('#lt-trans-uiEnhance').text(strings.UIEnhance);
    $('#lt-trans-autoTab').text(strings.autoOpen);
    $('#lt-trans-autoWidth').text(strings.autoWidth);
    $('#lt-trans-autoExpand').text(strings.autoExpand);
    $('#lt-trans-autoFocus').text(strings.autoFocus);
    $('#lt-trans-orient').text(strings.reOrient);
    $('#lt-trans-enClick').text(strings.enClick);
    $('#lt-trans-straClick').text(strings.clickStraight);
    $('#lt-trans-turnClick').text(strings.clickTurn);
    $('#lt-trans-mapHigh').text(strings.mapHighlight);
    $('#lt-trans-lnLabel').text(strings.laneLabel);
    $('#lt-trans-nodeHigh').text(strings.nodeHigh);
    $('#lt-trans-laOver').text(strings.LAOHigh);
    $('#lt-trans-csOver').text(strings.CSOHigh);
    $('#lt-trans-heurCan').text(strings.heuristics);
    $('#lt-trans-heurPos').text(strings.posHeur);
    $('#lt-trans-heurNeg').text(strings.negHeur);
    $('#lt-trans-highCol').text(strings.highColor);
    $('#lt-trans-fwdCol').text(strings.fwdCol);
    $('#lt-trans-revCol').text(strings.revCol);
    $('#lt-trans-labelCol').text(strings.labelCol);
    $('#lt-trans-errorCol').text(strings.errorCol);
    $('#lt-trans-nodeCol').text(strings.laneNodeCol);
    $('#lt-trans-tioCol').text(strings.nodeTIOCol);
    $('#lt-trans-laoCol').text(strings.LAOCol);
    $('#lt-trans-viewCol').text(strings.viewCSCol);
    $('#lt-trans-hearCol').text(strings.hearCSCol);
    $('#lt-trans-posCol').text(strings.heurPosCol);
    $('#lt-trans-negCol').text(strings.heurNegCol);
    $('#lt-trans-advTools').text(strings.advTools);
    $('#lt-trans-quickTog').text(strings.quickTog);
    $('#lt-trans-heurRBS').text(strings.showRBS);
    $('#lt-trans-csIcons').text(strings.csIcons);
    $('#lt-trans-highOver').text(strings.highlightOverride);
    $('#lt-trans-AddTIO').text(strings.addTIO);
    $('#lt-trans-enIcons').text(strings.enIcons);
    $('#lt-trans-IconsRotate').text(strings.IconsRotate);

    $('#lt-color-title').attr('data-original-title', strings.colTooltip);

    if (shortcutsDisabled) {
        $('#lt-EnableShortcut').text(`${strings.disabled}`);
        $('#lt-HighlightShortcut').text(`${strings.disabled}`);
        $('#lt-UIEnhanceShortcut').text(`${strings.disabled}`);
        $('#lt-LaneHeurChecksShortcut').text(`${strings.disabled}`);
    }
}

function setHeuristics() {
    if (RBSArray.failed) {
        return;
    }
    let angles = isRBS && getId('lt-serverSelect').checked ? configArray.RBS : configArray.RPS;

    MAX_LEN_HEUR = angles.MAX_LEN_HEUR;
    MAX_PERP_DIF = angles.MAX_PERP_DIF;
    MAX_PERP_DIF_ALT = angles.MAX_PERP_DIF_ALT;
    MAX_PERP_TO_CONSIDER = angles.MAX_PERP_TO_CONSIDER;
    MAX_STRAIGHT_TO_CONSIDER = angles.MAX_STRAIGHT_TO_CONSIDER;
    MAX_STRAIGHT_DIF = angles.MAX_STRAIGHT_DIF;
}

// Checks the WME value of a shortcut (from the shortcut menu) against the scripts value and saves if they are different
function checkShortcutsChanged() {
    let triggerSave = false;
    for (const name in W.accelerators.Actions) {
        const {shortcut, group} = W.accelerators.Actions[name];
        if (group === 'wmelt') {
            let TempKeys = '';
            if (shortcut) {
                if (shortcut.altKey === true) {
                    TempKeys += 'A';
                }
                if (shortcut.shiftKey === true) {
                    TempKeys += 'S';
                }
                if (shortcut.ctrlKey === true) {
                    TempKeys += 'C';
                }
                if (TempKeys !== '') {
                    TempKeys += '+';
                }
                if (shortcut.keyCode) {
                    TempKeys += shortcut.keyCode;
                }
            } else {
                TempKeys = '-1';
            }
            if (LtSettings[name] !== TempKeys) {
                triggerSave = true;
                console.log(`LaneTools: Stored shortcut ${name}: ${LtSettings[name]} changed to ${TempKeys}`);
                break;
            }
        }
    }
    if (triggerSave) {
        saveSettings();
        setTimeout(() => {
            updateShortcutLabels();
        }, 200);
    }
}

// Pulls the keyboard shortcuts from the script and returns a machine value
function getKeyboardShortcut(shortcut) {
    const keys = LtSettings[shortcut];
    let val = '';

    if (keys.indexOf('+') > -1) {
        const specialKeys = keys.split('+')[0];
        for (let i = 0; i < specialKeys.length; i++) {
            if (val.length > 0) {
                val += '+';
            }
            if (specialKeys[i] === 'C') {
                val += 'Ctrl';
            }
            if (specialKeys[i] === 'S') {
                val += 'Shift';
            }
            if (specialKeys[i] === 'A') {
                val += 'Alt';
            }
        }
        if (val.length > 0) {
            val += '+';
        }
        let num = keys.split('+')[1];
        if (num >= 96 && num <= 105) {
            // Numpad keys
            num -= 48;
            val += '[num pad]';
        }
        val += String.fromCharCode(num);
    } else {
        let num = Number.parseInt(keys, 10);
        if (num >= 96 && num <= 105) {
            // Numpad keys
            num -= 48;
            val += '[num pad]';
        }
        val += String.fromCharCode(num);
    }
    return val;
}

// Updates the UI tab with the shortcut values
function updateShortcutLabels() {
    if (!shortcutsDisabled) {
        $('#lt-EnableShortcut').text(getKeyboardShortcut('enableScript'));
        $('#lt-HighlightShortcut').text(getKeyboardShortcut('enableHighlights'));
        $('#lt-UIEnhanceShortcut').text(getKeyboardShortcut('enableUIEnhancements'));
        $('#lt-LaneHeurChecksShortcut').text(getKeyboardShortcut('enableHeuristics'));
    }
}

function getSegObj(id) {
    return W.model.segments.getObjectById(id);
}

function getNodeObj(id) {
    return W.model.nodes.getObjectById(id);
}

function lanesTabSetup() {
    // hook into edit panel on the left
    if (getId('edit-panel').getElementsByTagName('wz-tabs').length == 0) {
        setTimeout(lanesTabSetup, 800);
        console.log('Edit panel not yet loaded.');
        return;
    }
    
    const selSeg = W.selectionManager.getSelectedFeatures();
    let fwdDone = false;
    let revDone = false;
    let isRotated = false;

    function updateUI() {
        if (getId('lt-ReverseLanesIcon').checked && !isRotated) {
            rotateArrows();
        }

        if (getId('lt-highlightCSIcons').checked) {
            colorCSDir();
        }

        // Add delete buttons and preselected lane number buttons to UI
        if (_pickleColor >= 1 || editorInfo.editableCountryIDS.length > 0) {
            if (getId('li-del-opp-btn')) $('#li-del-opp-btn').remove();

            let $fwdButton = $(`<button type="button" id="li-del-fwd-btn" style="height:20px;background-color:white;border:1px solid grey;border-radius:8px;">${strings.delFwd}</button>`);
            let $revButton = $(`<button type="button" id="li-del-rev-btn" style="height:20px;background-color:white;border:1px solid grey;border-radius:8px;">${strings.delRev}</button>`);
            let $oppButton = $(`<button type="button" id="li-del-opp-btn" style="height:auto;background-color:orange;border:1px solid grey;border-radius:8px; margin-bottom:5px;">${strings.delOpp}</button>`);
            let $btnCont1 = $('<div style="display:inline-block;position:relative;" />');
            let $btnCont2 = $('<div style="display:inline-block;position:relative;" />');
            let $btnCont3 = $('<div style="display:inline-block;position:relative;" />');
            $fwdButton.appendTo($btnCont1);
            $revButton.appendTo($btnCont2);
            $oppButton.appendTo($btnCont3);

            const delFwd = $('#li-del-fwd-btn');
            const delRev = $('#li-del-rev-btn');
            const delOpp = $('#li-del-opp-btn');
            delFwd.off();
            delRev.off();
            delOpp.off();

            if (!getId('li-del-rev-btn') && !revDone && selSeg[0].model.getRevLanes().laneCount > 0) {
                if($('.rev-lanes > div > div > div.lane-instruction.lane-instruction-from > div.instruction').length > 0) {
                    $btnCont2.prependTo('.rev-lanes > div > div > div.lane-instruction.lane-instruction-from > div.instruction');
                    $('.rev-lanes > div > div > div.lane-instruction.lane-instruction-from > div.instruction').css('border-bottom', `4px dashed ${LtSettings.BAColor}`);
                } else if (selSeg[0].model.attributes.revDirection != true) { //jm6087
                    $oppButton.prop('title', 'rev');
                    $oppButton.prependTo(("#edit-panel > div > div > div > div.segment-edit-section > wz-tabs > wz-tab.lanes-tab"));
                }
            } else {
                $('.rev-lanes > div > div > div.lane-instruction.lane-instruction-from > div.instruction').css('border-bottom', `4px dashed ${LtSettings.BAColor}`);
            }

            if (!getId('li-del-fwd-btn') && !fwdDone && selSeg[0].model.getFwdLanes().laneCount > 0) {
                if($('.fwd-lanes > div > div > div.lane-instruction.lane-instruction-from > div.instruction').length > 0) {
                    $btnCont1.prependTo('.fwd-lanes > div > div > div.lane-instruction.lane-instruction-from > div.instruction');
                    $('.fwd-lanes > div > div > div.lane-instruction.lane-instruction-from > div.instruction').css('border-bottom', `4px dashed ${LtSettings.ABColor}`);
                } else if (selSeg[0].model.attributes.fwdDirection != true) { //jm6087
                    $oppButton.prop('title', 'fwd');
                    $oppButton.prependTo(("#edit-panel > div > div > div > div.segment-edit-section > wz-tabs > wz-tab.lanes-tab"));
                }
            } else {
                $('.fwd-lanes > div > div > div.lane-instruction.lane-instruction-from > div.instruction').css('border-bottom', `4px dashed ${LtSettings.ABColor}`);
            }

            $('#li-del-fwd-btn').click(function () {
                delLanes('fwd');
                fwdDone = true;
                setTimeout(function () {
                    updateUI();
                }, 200);
            });
            $('#li-del-rev-btn').click(function () {
                delLanes('rev');
                revDone = true;
                setTimeout(function () {
                    updateUI();
                }, 200);
            });
            $('#li-del-opp-btn').click(function () {
                let dir = $(this).prop('title');
                delLanes(dir);
                if (dir === 'rev') {
                    revDone = true;
                } else {
                    fwdDone = true;
                }

                updateUI();
            });
        }

        const laneGuideEdit = $('.edit-lane-guidance');
        laneGuideEdit.off();
        laneGuideEdit.click(function () {
            if ($(this).parents('.fwd-lanes').length) {
                setTimeout(function () {
                    insertSelAll('fwd');
                    addLnsBtns();
                    adjustSpace();
                    focusEle();
                    applyButtonListeners();
                    if (getId('lt-AddTIO').checked) addTIOUI('fwd');
                }, 100);
            }
            if ($(this).parents('.rev-lanes').length) {
                setTimeout(function () {
                    insertSelAll('rev');
                    addLnsBtns();
                    adjustSpace();
                    focusEle();
                    applyButtonListeners();
                    if (getId('lt-AddTIO').checked) addTIOUI('rev');
                }, 100);
            }
        });

        if (!fwdDone && !revDone) {
            expandEdit();
        }

        adjustSpace();
    }

    function applyButtonListeners() {
        $('.apply-button.waze-btn.waze-btn-blue').off();
        $('.cancel-button').off();
        const fwdLanes = $('.fwd-lanes');
        const revLanes = $('.rev-lanes');
        fwdLanes.find('.apply-button.waze-btn.waze-btn-blue').click(() => {
            fwdDone = true;
            setTimeout(function () {
                updateUI();
            }, 200);
        });
        revLanes.find('.apply-button.waze-btn.waze-btn-blue').click(() => {
            revDone = true;
            setTimeout(function () {
                updateUI();
            }, 200);
        });
        fwdLanes.find('.cancel-button').click(() => {
            fwdDone = true;
            setTimeout(function () {
                updateUI();
            }, 200);
        });
        revLanes.find('.cancel-button').click(() => {
            revDone = true;
            setTimeout(function () {
                updateUI();
            }, 200);
        });
    }

    function expandEdit() {
        if (getId('lt-AutoExpandLanes').checked) {
            if (!fwdDone) {
//DISABLED jm6087                $('.fwd-lanes').find('.edit-lane-guidance').click();
            }
            if (!revDone) {
//DISABLED jm6087                $('.rev-lanes').find('.edit-lane-guidance').click();
            }
        }
        if (getId('lt-AutoOpenWidth').checked) {
            if (!fwdDone) {
                $('.fwd-lanes').find('.set-road-width > wz-button').click(); // ADDED
            }
            if (!revDone) {
                $('.rev-lanes').find('.set-road-width > wz-button').click();  // ADDED
            }
        }
    }

    function adjustSpace() {
        $('.fwd-lanes > div > .direction-lanes').css({'padding': '5px 5px 10px', 'margin-bottom': '10px'});
        $('.rev-lanes > div > .direction-lanes').css({'padding': '5px 5px 10px', 'margin': '0px'});
        $('.fwd-lanes > div > div > .lane-instruction.lane-instruction-to > .instruction > .lane-edit > .edit-region > div > .controls.direction-lanes-edit').css('padding-top', '10px');
        $('.rev-lanes > div > div > .lane-instruction.lane-instruction-to > .instruction > .lane-edit > .edit-region > div > .controls.direction-lanes-edit').css('padding-top', '10px');
        $('.fwd-lanes > div > div > div.lane-instruction.lane-instruction-to > div.instruction > div.edit-region > div > div > div:nth-child(1)').css('margin-bottom', '4px');
        $('.rev-lanes > div > div > div.lane-instruction.lane-instruction-to > div.instruction > div.edit-region > div > div > div:nth-child(1)').css('margin-bottom', '4px');
    }

    function addLnsBtns() {
        // Add predetermined lane values
        if ($('.fwd-lanes').find('.direction-lanes').children().length > 0 && !getId('lt-fwd-add-lanes')) {
            let $addLanes1 = $('<div class="lt-add-lanes fwd">1</div>');
            let $addLanes2 = $('<div class="lt-add-lanes fwd">2</div>');
            let $addLanes3 = $('<div class="lt-add-lanes fwd">3</div>');
            let $addLanes4 = $('<div class="lt-add-lanes fwd">4</div>');
            let $addLanes5 = $('<div class="lt-add-lanes fwd">5</div>');
            let $addLanes6 = $('<div class="lt-add-lanes fwd">6</div>');
            let $addLanes7 = $('<div class="lt-add-lanes fwd">7</div>');
            let $addLanes8 = $('<div class="lt-add-lanes fwd">8</div>');
            let $addLanesContFwd = $('<div style="display:inline-flex;flex-direction:row;justify-content:space-around;margin-top:4px;" id="lt-fwd-add-lanes" />');

            $addLanes1.appendTo($addLanesContFwd);
            $addLanes2.appendTo($addLanesContFwd);
            $addLanes3.appendTo($addLanesContFwd);
            $addLanes4.appendTo($addLanesContFwd);
            $addLanes5.appendTo($addLanesContFwd);
            $addLanes6.appendTo($addLanesContFwd);
            $addLanes7.appendTo($addLanesContFwd);
            $addLanes8.appendTo($addLanesContFwd);
            $addLanesContFwd.appendTo('.fwd-lanes > div > div > div.lane-instruction.lane-instruction-to > div.instruction > div.edit-region > div > div > div:nth-child(1) > div');
        }

        if ($('.rev-lanes').find('.direction-lanes').children().length > 0 && !getId('lt-rev-add-lanes')) {
            let $addLanes1 = $('<div class="lt-add-lanes rev">1</div>');
            let $addLanes2 = $('<div class="lt-add-lanes rev">2</div>');
            let $addLanes3 = $('<div class="lt-add-lanes rev">3</div>');
            let $addLanes4 = $('<div class="lt-add-lanes rev">4</div>');
            let $addLanes5 = $('<div class="lt-add-lanes rev">5</div>');
            let $addLanes6 = $('<div class="lt-add-lanes rev">6</div>');
            let $addLanes7 = $('<div class="lt-add-lanes rev">7</div>');
            let $addLanes8 = $('<div class="lt-add-lanes rev">8</div>');
            let $addLanesContRev = $('<div style="display:inline-flex;flex-direction:row;justify-content:space-around;margin-top:4px;" id="lt-rev-add-lanes" />');

            $addLanes1.appendTo($addLanesContRev);
            $addLanes2.appendTo($addLanesContRev);
            $addLanes3.appendTo($addLanesContRev);
            $addLanes4.appendTo($addLanesContRev);
            $addLanes5.appendTo($addLanesContRev);
            $addLanes6.appendTo($addLanesContRev);
            $addLanes7.appendTo($addLanesContRev);
            $addLanes8.appendTo($addLanesContRev);
            $addLanesContRev.appendTo('.rev-lanes > div > div > div.lane-instruction.lane-instruction-to > div.instruction > div.edit-region > div > div > div:nth-child(1) > div');
        }

        $('.lt-add-lanes').click(function () {
            let numAdd = $(this).text();
            numAdd = Number.parseInt(numAdd, 10);

            if ($(this).hasClass('lt-add-lanes fwd')) {
                const fwdLanes = $('.fwd-lanes');
                fwdLanes.find('.form-control').val(numAdd);
                fwdLanes.find('.form-control').change();
                fwdLanes.find('.form-control').focus();
            }
            if ($(this).hasClass('lt-add-lanes rev')) {
                const revLanes = $('.rev-lanes');
                revLanes.find('.form-control').val(numAdd);
                revLanes.find('.form-control').change();
                revLanes.find('.form-control').focus();
            }});

        if ($('.fwd-lanes').find('.lane-width-card').children().length > 0 && !getId('lt-fwd-add-Width')) {
            let $addWidth1 = $('<div class="lt-add-Width fwd">1</div>');
            let $addWidth2 = $('<div class="lt-add-Width fwd">2</div>');
            let $addWidth3 = $('<div class="lt-add-Width fwd">3</div>');
            let $addWidth4 = $('<div class="lt-add-Width fwd">4</div>');
            let $addWidth5 = $('<div class="lt-add-Width fwd">5</div>');
            let $addWidth6 = $('<div class="lt-add-Width fwd">6</div>');
            let $addWidth7 = $('<div class="lt-add-Width fwd">7</div>');
            let $addWidth8 = $('<div class="lt-add-Width fwd">8</div>');
            let $addWidthContFwd = $('<div style="position:relative;display:block;width:100%;" id="lt-fwd-add-Width" />');

            $addWidth1.appendTo($addWidthContFwd);
            $addWidth2.appendTo($addWidthContFwd);
            $addWidth3.appendTo($addWidthContFwd);
            $addWidth4.appendTo($addWidthContFwd);
            $addWidth5.appendTo($addWidthContFwd);
            $addWidth6.appendTo($addWidthContFwd);
            $addWidth7.appendTo($addWidthContFwd);
            $addWidth8.appendTo($addWidthContFwd);
            $addWidthContFwd.prependTo('.fwd-lanes > div > div > .lane-instruction.lane-instruction-from > .instruction > .road-width-edit > div > div > div > .lane-width-card');
        }

        if ($('.rev-lanes').find('.lane-width-card').children().length > 0 && !getId('lt-rev-add-Width')) {
            let $addWidth1 = $('<div class="lt-add-Width rev">1</div>');
            let $addWidth2 = $('<div class="lt-add-Width rev">2</div>');
            let $addWidth3 = $('<div class="lt-add-Width rev">3</div>');
            let $addWidth4 = $('<div class="lt-add-Width rev">4</div>');
            let $addWidth5 = $('<div class="lt-add-Width rev">5</div>');
            let $addWidth6 = $('<div class="lt-add-Width rev">6</div>');
            let $addWidth7 = $('<div class="lt-add-Width rev">7</div>');
            let $addWidth8 = $('<div class="lt-add-Width rev">8</div>');
            let $addWidthContRev = $('<div style="position:relative;display:block;width:100%;" id="lt-rev-add-Width" />');

            $addWidth1.appendTo($addWidthContRev);
            $addWidth2.appendTo($addWidthContRev);
            $addWidth3.appendTo($addWidthContRev);
            $addWidth4.appendTo($addWidthContRev);
            $addWidth5.appendTo($addWidthContRev);
            $addWidth6.appendTo($addWidthContRev);
            $addWidth7.appendTo($addWidthContRev);
            $addWidth8.appendTo($addWidthContRev);
            $addWidthContRev.prependTo('.rev-lanes > div > div > .lane-instruction.lane-instruction-from > .instruction > .road-width-edit > div > div > div > .lane-width-card');
        }

    $('.lt-add-Width').click(function () {
            let numAdd = $(this).text();
            numAdd = Number.parseInt(numAdd, 10);

            if ($(this).hasClass('lt-add-Width fwd')) {
                const fwdLanes = $('.fwd-lanes');
                fwdLanes.find('#number-of-lanes').val(numAdd);
                fwdLanes.find('#number-of-lanes').change();
                fwdLanes.find('#number-of-lanes').focus();
            }
            if ($(this).hasClass('lt-add-Width rev')) {
                const revLanes = $('.rev-lanes');
                revLanes.find('#number-of-lanes').val(numAdd);
                revLanes.find('#number-of-lanes').change();
                revLanes.find('#number-of-lanes').focus();
            }
        });
    }

    function focusEle() {
        // Places the focus on the relevant lanes # input if the direction exists
        if (getId('lt-AutoFocusLanes').checked) {
            const fwdLanes = $('.fwd-lanes');
            const revLanes = $('.rev-lanes');
            if (fwdLanes.find('.edit-region').children().length > 0 && !fwdDone) {
                fwdLanes.find('.form-control').focus();
            } else if (revLanes.find('.edit-region').children().length > 0 && !revDone) {
                revLanes.find('.form-control').focus();
            }
        }
    }

    function insertSelAll(dir) {
        if (getId('lt-SelAllEnable').checked) {
            $('.street-name').css('user-select', 'none');
            let inputDirection = dir === 'fwd' ? $('.fwd-lanes').find('.form-control')[0] : $('.rev-lanes').find('.form-control')[0];
            let startVal = $(inputDirection).val();

            // Toggles all checkboxes in turns row
            $(inputDirection).change(function () {
                let boxDirection;
                if ($(this).parents('.fwd-lanes').length) {
                    boxDirection = $('.fwd-lanes').find('.controls-container.turns-region');
                } else if ($(this).parents('.rev-lanes').length) {
                    boxDirection = $('.rev-lanes').find('.controls-container.turns-region');
                }

                boxDirection = $('.street-name', boxDirection);

                for (let p = 0; p < boxDirection.length; p++) {
                    $(boxDirection[p]).off();
                    $(boxDirection[p]).click(function () {
                        let secParent = $(this).get(0);
                        let contParent = secParent.parentElement;
                        let chkBxs = $('.checkbox-large.checkbox-white', contParent);
                        const firstCheckInv = !getId(chkBxs[0].id).checked;

                        for (let i = 0; i < chkBxs.length; i++) {
                            const checkBox = $(`#${chkBxs[i].id}`);
                            checkBox.prop('checked', firstCheckInv);
                            checkBox.change();
                        }
                    });
                }
            });

            if (startVal > 0) {
                $(inputDirection).change();
            }
        }
    }

    function colorCSDir() {
        const seg = selSeg[0].model;
        const fwdNode = getNodeObj(seg.attributes.toNodeID);
        const revNode = getNodeObj(seg.attributes.fromNodeID);

        let fwdConfig = checkLanesConfiguration(seg, fwdNode, fwdNode.attributes.segIDs, seg.attributes.fwdLaneCount);
        let revConfig = checkLanesConfiguration(seg, revNode, revNode.attributes.segIDs, seg.attributes.revLaneCount);

        if (fwdConfig[4] > 0) {
            let csColor = fwdConfig[4] === 1 ? LtSettings.CS1Color : LtSettings.CS2Color;

            let arrowDiv = $('#segment-edit-lanes > div > div > div.fwd-lanes > div > div > div.lane-instruction.lane-instruction-to > div.instruction > div.lane-arrows > div').children();
            for (i=0;i< arrowDiv.length;i++) {
                if (arrowDiv[i].title == fwdConfig[5]) {
                    $(arrowDiv[i]).css('background-color', csColor)
                }
            }
        }

        if (revConfig[4] > 0) {
            let csColor = revConfig[4] === 1 ? LtSettings.CS1Color : LtSettings.CS2Color;

            let arrowDiv = $('#segment-edit-lanes > div > div > div.rev-lanes > div > div > div.lane-instruction.lane-instruction-to > div.instruction > div.lane-arrows > div').children();
            for (i=0;i< arrowDiv.length;i++) {
                if (arrowDiv[i].title == revConfig[5]) {
                    $(arrowDiv[i]).css('background-color', csColor)
                }
            }
        }
    }

    // Rotates lane display arrows in lane tab for South directions
    // Function written by Dude495 and modified by SkiDooGuy to fit into LaneTools better
    function rotateArrows() {
        let direction = document.getElementsByClassName('heading');
        let boxDiv = $('.lane-arrows > div').get();

        for (let i = 0; i < direction.length; i++) {
            if (direction[i].textContent.includes('south')) {
                let arrows = $(boxDiv[i]).children();
                $(arrows).css('transform', 'rotate(180deg)');
                $(boxDiv[i]).append(arrows.get().reverse());
            }
        }
        isRotated = true;
    }

    // Begin lanes tab enhancements
    if (getId('lt-UIEnable').checked && getId('lt-ScriptEnabled').checked && (selSeg.length > 0)) {
        if (selSeg.length === 1 && selSeg[0].model.type === 'segment') { // Check to ensure that there is only one segment object selected, then setup click event
            $('.lanes-tab').click(() => {
                fwdDone = false;
                revDone = false;
                setTimeout(() => {
                    updateUI();
                }, 100);
            });

            if (getId('lt-AutoLanesTab').checked) { // If the auto open lanes option is enabled, initiate a click event on the Lanes tab element
                setTimeout(() => {
                    $('.lanes-tab').click();
                }, 100);
            }
        } else if (selSeg.length === 2) {
            // We have exactly TWO features selected.  Check heuristics and highlight
            scanHeuristicsCandidates(selSeg,);
        }
    }
}

// Toggles parts of script when the keyboard shortcut is used
function toggleScript() {
    $('#lt-ScriptEnabled').click();
}

function toggleHighlights() {
    $('#lt-HighlightsEnable').click();
}

function toggleUIEnhancements() {
    $('#lt-UIEnable').click();
}

function toggleLaneHeuristicsChecks() {
    $('#lt-LaneHeuristicsChecks').click();
}

function displayToolbar() {
    const objSelected = W.selectionManager.getSelectedFeatures();

    if (objSelected.length === 1 && getId('lt-CopyEnable').checked && getId('lt-ScriptEnabled').checked) {
        if (objSelected[0].model.type.toLowerCase() === 'segment') {
            const map = $('#map');
            $('#lt-toolbar-container').css({
                display: 'block',
                left: (map.width() * 0.10),
                top: (map.height() * 0.10)
            });
        }
    } else {
        $('#lt-toolbar-container').css('display', 'none');
    }
}

function getId(ele) {
    return document.getElementById(ele);
}

// returns true if object is within window  bounds and above zoom threshold
function onScreen(obj, curZoomLevel) {
    if (!obj.geometry || !obj.attributes) {
        return false;
    }

    // Either FREEWAY or Zoom >=4
    if ((curZoomLevel >= DisplayLevels.MIN_ZOOM_NONFREEWAY) ||
        (obj.type === 'segment' && obj.attributes.roadType === LT_ROAD_TYPE.FREEWAY)) {
        return (W.map.getExtent().intersectsBounds(obj.geometry.getBounds()));
    }

    return false;
}

// borrowed from JAI
function getCardinalAngle(nodeId,segment) {
    if (nodeId == null || segment == null) {
        return null;
    }
    let ja_dx, ja_dy;
    if (segment.attributes.fromNodeID === nodeId) {
        ja_dx = lt_get_second_point(segment).x - lt_get_first_point(segment).x;
        ja_dy = lt_get_second_point(segment).y - lt_get_first_point(segment).y;
    } else {
        ja_dx = lt_get_next_to_last_point(segment).x - lt_get_last_point(segment).x;
        ja_dy = lt_get_next_to_last_point(segment).y - lt_get_last_point(segment).y;
    }

    let angle_rad = Math.atan2(ja_dy, ja_dx);
    let angle_deg = (angle_rad * 180 / Math.PI) % 360;
    if (angle_deg < 0) angle_deg = angle_deg + 360;
    // console.log('Cardinal: ' + Math.round(angle_deg));
    return Math.round(angle_deg);
}

// borrowed from JAI
function lt_get_first_point(segment) {
    return segment.geometry.components[0];
}

// borrowed from JAI
function lt_get_last_point(segment) {
    return segment.geometry.components[segment.geometry.components.length - 1];
}

// borrowed from JAI
function lt_get_second_point(segment) {
    return segment.geometry.components[1];
}

// borrowed from JAI
function lt_get_next_to_last_point(segment) {
    return segment.geometry.components[segment.geometry.components.length - 2];
}

function delLanes(dir) {
    const selObjs = W.selectionManager.getSelectedFeatures();
    const selSeg = selObjs[0].model;
    const turnGraph = W.model.getTurnGraph();
    const mAction = new MultiAction();
    let node;
    let conSegs;
    let updates = {};

    mAction.setModel(W.model);

    if (dir === 'fwd') {
        updates.fwdLaneCount = 0;
        node = getNodeObj(selSeg.attributes.toNodeID);
        conSegs = node.getSegmentIds();
        const fwdLanes = $('.fwd-lanes');
        fwdLanes.find('.form-control').val(0);
        fwdLanes.find('.form-control').change();
    }
    if (dir === 'rev') {
        updates.revLaneCount = 0;
        node = getNodeObj(selSeg.attributes.fromNodeID);
        conSegs = node.getSegmentIds();
        const revLanes = $('.rev-lanes');
        revLanes.find('.form-control').val(0);
        revLanes.find('.form-control').change();
    }

    mAction.doSubAction(new UpdateObj(selSeg, updates));

    for (let i = 0; i < conSegs.length; i++) {
        let turnStatus = turnGraph.getTurnThroughNode(node, selSeg, getSegObj(conSegs[i]));
        let turnData = turnStatus.getTurnData();

        if (turnData.hasLanes()) {
            turnData = turnData.withLanes();
            turnStatus = turnStatus.withTurnData(turnData);

            mAction.doSubAction(new SetTurn(turnGraph, turnStatus));
        }
    }

    mAction._description = 'Deleted lanes and turn associations';
    W.model.actionManager.add(mAction);
}

function removeHighlights() {
    LTHighlightLayer.removeAllFeatures();
    LTNamesLayer.removeAllFeatures();
}

function removeLaneGraphics() {
    LTLaneGraphics.removeAllFeatures();
}

function applyName(geo, fwdLnsCount, revLnsCount) {
    let nameGeo = geo.clone();
    let laneNum = `${fwdLnsCount} / ${revLnsCount}`;
    let lnLabel = new OpenLayers.Feature.Vector(nameGeo, {
        labelText: laneNum,
        labelColor: LtSettings.LabelColor
    });
    LTNamesLayer.addFeatures([lnLabel]);
}

function highlightSegment(objGeo, direction, applyDash, applyLabels, fwdLnsCount, revLnsCount, applyLioHighlight, csMode, isBad, heur, heurOverHighlight) {
    const VectorStyle = {
        DASH_THIN: 1,
        DASH_THICK: 2,
        HIGHLIGHT: 10,
        OVER_HIGHLIGHT: 20
    };

    const geo = objGeo.clone();
    const applyCSHighlight = getId('lt-CSEnable').checked;

    // Need to rework this to account for segment length, cause of geo adjustment and such
    if (geo.components.length > 2) {
        let geoLength = geo.components.length;
        let geoMiddle = geoLength / 2;
        let fwdPoint = geoLength % 2 ? (Math.ceil(geoMiddle) - 1) : (Math.ceil(geoMiddle));
        let revPoint = geoLength % 2 ? (Math.floor(geoMiddle) + 1) : (Math.floor(geoMiddle));

        if (direction === Direction.FORWARD) {
            let newString = buildGeoComponentString(geo, fwdPoint, geoLength);
            if (applyDash) {
                createVector(newString, `${LtSettings.ABColor}`, VectorStyle.DASH_THIN);
            } // draw dashed line
            drawHighlight(newString, applyLioHighlight, isBad, heur, heurOverHighlight); // draw highlight
        } else if (direction === Direction.REVERSE) {
            let newString = buildGeoComponentString(geo, 0, revPoint);
            if (applyDash) {
                createVector(newString, `${LtSettings.BAColor}`, VectorStyle.DASH_THIN);
            }
            drawHighlight(newString, applyLioHighlight, isBad, heur, heurOverHighlight);
        }

        // Add the label only on the forward pass, or reverse if there are no forward lanes
        if (applyLabels && (Direction.FORWARD || fwdLnsCount === 0)) {
            if (geoLength % 2) {
                applyName(geo.components[fwdPoint], fwdLnsCount, revLnsCount);
            } else {
                let p0 = geo.components[revPoint - 1];
                let p1 = geo.components[fwdPoint];
                let newPoint = new OpenLayers.Geometry.Point((p0.x + p1.x) / 2, (p0.y + p1.y) / 2);
                applyName(newPoint, fwdLnsCount, revLnsCount);
            }
        }
    } else {
        let p0 = geo.components[0];
        let p1 = geo.components[1];
        let point1 = new OpenLayers.Geometry.Point((p0.x + p1.x) / 2, (p0.y + p1.y) / 2);

        if (direction === Direction.FORWARD) {
            let point2 = new OpenLayers.Geometry.Point(geo.components[1].clone().x, geo.components[1].clone().y);
            let newString = new OpenLayers.Geometry.LineString([point1, point2], {});
            if (applyDash) {
                createVector(newString, `${LtSettings.ABColor}`, VectorStyle.DASH_THIN);
            }
            drawHighlight(newString, applyLioHighlight, isBad, heur, heurOverHighlight);
        } else if (direction === Direction.REVERSE) {
            let point2 = new OpenLayers.Geometry.Point(geo.components[0].clone().x, geo.components[0].clone().y);
            let newString = new OpenLayers.Geometry.LineString([point1, point2], {});
            if (applyDash) {
                createVector(newString, `${LtSettings.BAColor}`, VectorStyle.DASH_THIN);
            }
            drawHighlight(newString, applyLioHighlight, isBad, heur, heurOverHighlight);
        }

        // Add the label only on the forward pass, or reverse if there are no forward lanes
        if (applyLabels && (Direction.FORWARD || fwdLnsCount === 0)) {
            applyName(point1, fwdLnsCount, revLnsCount);
        }
    }

    function buildGeoComponentString(geometry, from, to) {
        let components = [];
        for (let i = from; i < to; i++) {
            components[i] = geometry.components[i].clone();
        }
        return new OpenLayers.Geometry.LineString(components, {});
    }

    function drawHighlight(newString, lio, bad, heurNom, heurOverHighlight = false) {
        if (bad) {
            createVector(newString.clone(), `${LtSettings.ErrorColor}`, VectorStyle.OVER_HIGHLIGHT);
            return;
        }
        if (lio) {
            createVector(newString.clone(), `${LtSettings.LIOColor}`, VectorStyle.HIGHLIGHT);
        }
        if (csMode === 1 && applyCSHighlight) {
            createVector(newString.clone(), `${LtSettings.CS1Color}`, VectorStyle.HIGHLIGHT);
        }
        if (csMode === 2 && applyCSHighlight) {
            createVector(newString.clone(), `${LtSettings.CS2Color}`, VectorStyle.HIGHLIGHT);
        }
        if (heurNom === HeuristicsCandidate.PASS) {
            createVector(newString.clone(), `${LtSettings.HeurColor}`, heurOverHighlight ? VectorStyle.OVER_HIGHLIGHT : VectorStyle.HIGHLIGHT);
        } else if (heurNom === HeuristicsCandidate.FAIL) {
            createVector(newString.clone(), `${LtSettings.HeurFailColor}`, heurOverHighlight ? VectorStyle.OVER_HIGHLIGHT : VectorStyle.HIGHLIGHT);
        }
    }

    function createVector(geoCom, lineColor, style) {
        let newVector = new OpenLayers.Feature.Vector(geoCom, {}, {});
        LTHighlightLayer.addFeatures([newVector]);

        const line = document.getElementById(geoCom.id);

        if (line) {
            line.setAttribute('stroke', `${lineColor}`);

            if (style === VectorStyle.HIGHLIGHT) {
                line.setAttribute('stroke-width', '15');
                line.setAttribute('stroke-opacity', '.6');
            } else if (style === VectorStyle.OVER_HIGHLIGHT) {
                line.setAttribute('stroke-width', '18');
                line.setAttribute('stroke-opacity', '.85');
            } else {
                line.setAttribute('stroke-opacity', '1');
                if (style === VectorStyle.DASH_THICK) {
                    line.setAttribute('stroke-width', '8');
                    line.setAttribute('stroke-dasharray', '8 10');
                } else if (style === VectorStyle.DASH_THIN) {
                    line.setAttribute('stroke-width', '4');
                    line.setAttribute('stroke-dasharray', '10 10');
                }
            }
        }
    }

    LTHighlightLayer.setZIndex(450);
}

function highlightNode(objGeo, color, overSized = false) {
    const geo = objGeo.clone();
    const highlight = new OpenLayers.Feature.Vector(geo, {});
    LTHighlightLayer.addFeatures([highlight]);
    const node = document.getElementById(geo.id);

    if (node) {
        node.setAttribute('fill', color);
        node.setAttribute('r', overSized ? '18' : '10');
        node.setAttribute('fill-opacity', '0.9');
        node.setAttribute('stroke-width', '0');
    }
}

let lt_scanArea_timer = {
    start: function () {
        this.cancel();
        let lt_scanArea_timer_self = this;
        this.timeoutID = window.setTimeout(function () {
            lt_scanArea_timer_self.calculate();
        }, 500);
    },

    calculate: function () {
        scanArea_real();
        delete this.timeoutID;
    },

    cancel: function () {
        if (typeof this.timeoutID === 'number') {
            window.clearTimeout(this.timeoutID);
            delete this.timeoutID;
            lt_scanArea_recursive = 0;
        }
    }
};

function scanArea() {
    // Use a delay timer to ensure the DOM is settled
    lt_scanArea_recursive = 3;
    scanArea_real();
}

function scanArea_real() {
    const isEnabled = getId('lt-ScriptEnabled').checked;
    const mapHighlights = getId('lt-HighlightsEnable').checked;
    const heurChecks = getId('lt-LaneHeuristicsChecks').checked;
    const zoomLevel = W.map.getZoom() != null ? W.map.getZoom() : 16;
    const highOverride = getId('lt-highlightOverride').checked; // jm6087
    const layerCheck = W.layerSwitcherController.getTogglerState('ITEM_ROAD') || W.layerSwitcherController.getTogglerState('ITEM_ROAD_V2') //jm6087

    removeHighlights();

    // console.log(zoomLevel);
    if (zoomLevel < DisplayLevels.MIN_ZOOM_ALL) {
        return;
    }
    // If segment layer is checked (true) or (segment layer is not checked (false) and highlight override is set to show only when segment layer on - not checked (false)
    if (layerCheck || (!layerCheck && !highOverride)) { //jm6087
        if (isEnabled && (mapHighlights || heurChecks)) {
            scanSegments(W.model.segments.getObjectArray(), false);
        }

        if (isEnabled) {
            const selFeat = W.selectionManager.getSelectedFeatures();
            if (selFeat.length === 2) {
                // We have exactly TWO features selected.  Check heuristics and highlight
                scanHeuristicsCandidates(selFeat);
            }
        }
    } //jm6087
}

// Given two features, checks if they are segments, and their path qualifies for heuristics; then highlight
function scanHeuristicsCandidates(features) {
    let segs = [];
    let count = 0;
    _.each(features, f => {
        if (f && f.model && f.model.type === 'segment') {
            count = segs.push(f.model);
        }
    });

    scanSegments(segs, true);
    return count;
}

// Check all given segments for heuristics qualification
function scanSegments(segments, selectedSegsOverride) {
    const heurChecks = getId('lt-LaneHeuristicsChecks').checked;
    const heurScan_PosHighlight = heurChecks && getId('lt-LaneHeurPosHighlight').checked;
    const heurScan_NegHighlight = heurChecks && getId('lt-LaneHeurNegHighlight').checked;
    const mapHighlights = getId('lt-HighlightsEnable').checked;
    const applyLioHighlight = mapHighlights && getId('lt-LIOEnable').checked;
    const applyLabels = mapHighlights && getId('lt-LabelsEnable').checked;
    const zoomLevel = W.map.getZoom() != null ? W.map.getZoom() : 16;
    const turnGraph = W.model.getTurnGraph();

    // console.log(zoomLevel);

    _.each(segments, s => {
        if (onScreen(s, zoomLevel)) {
            const sAtts = s.getFeatureAttributes();
            let tryRedo = false;
            let segLength = lt_segment_length(s);

            // FORWARD
            tryRedo = tryRedo || scanSegment_Inner(s, sAtts, Direction.FORWARD, segLength, tryRedo);

            // If errors encountered, scan again. (Usually this is an issue with first loading of DOM after zoom or long pan)
            if (tryRedo && lt_scanArea_recursive > 0) {
                lt_log('LT errors found, scanning again', 2);
                removeHighlights();
                lt_scanArea_recursive--;
                lt_scanArea_timer.start();
                return;
            }

            tryRedo = tryRedo || scanSegment_Inner(s, sAtts, Direction.REVERSE, segLength, tryRedo);

            // If errors encountered, scan again. (Usually this is an issue with first loading of DOM after zoom or long pan)
            if (tryRedo && lt_scanArea_recursive > 0) {
                lt_log('LT errors found, scanning again', 2);
                removeHighlights();
                lt_scanArea_recursive--;
                lt_scanArea_timer.start();
                return;
            }
        }
    });

    function scanSegment_Inner(seg, sAtts, direction, segLength, tryRedo) {
        const fwdLaneCount = sAtts.fwdLaneCount;
        const revLaneCount = sAtts.revLaneCount;

        let node = getNodeObj(sAtts.toNodeID);
        let oppNode = getNodeObj(sAtts.fromNodeID);
        let laneCount = fwdLaneCount;
        let oppLaneCount = revLaneCount;

        if (direction !== Direction.FORWARD) {
            node = getNodeObj(sAtts.fromNodeID);
            oppNode = getNodeObj(sAtts.toNodeID);
            laneCount = revLaneCount;
            oppLaneCount = fwdLaneCount;    
        }

        let tlns = false;
        let tio = false;
        let badLn = false;
        let lio = false;
        let csMode = 0;
        let heurCand = HeuristicsCandidate.NONE;
        let entrySeg = null;

        let entrySegRef = {
            seg: 0,
            direction: Direction.NONE
        };

        // CHECK LANES & HEURISTICS
        if (onScreen(node, zoomLevel)) {
            const nodeSegs = node.getSegmentIds();

            if (laneCount > 0) {
                let config = checkLanesConfiguration(seg, node, nodeSegs, laneCount);
                tlns = config[0];
                tio = config[1];
                lio = config[2];
                badLn = config[3];
                csMode = config[4];
                tryRedo = badLn || tryRedo;
            }

            // 1/1/21: Only check for heuristics on segments <50m. IMPORTANT because now we're checking segments regardless of lanes
            if (segLength <= MAX_LEN_HEUR) {

                // Check Heuristics regardless of heurChecks, because we want to report Errors even if Heur highlights are off
                heurCand = isHeuristicsCandidate(seg, node, nodeSegs, oppNode, laneCount, segLength, turnGraph, entrySegRef);
                if (heurCand === HeuristicsCandidate.ERROR) {
                    // fwdHeurCand = HeuristicsCandidate.NONE;
                    badLn = true;
                }
                if (!heurChecks) {
                    heurCand = HeuristicsCandidate.NONE;
                }
                else if (heurCand !== HeuristicsCandidate.NONE) {
                    entrySeg = { ...entrySegRef };
                }
            }
        }

        // HIGHLIGHTS
        if (!selectedSegsOverride) {
            // Full scan highlights
            let heur = null;
            if ((heurScan_PosHighlight && heurCand === HeuristicsCandidate.PASS) || (heurScan_NegHighlight && heurCand === HeuristicsCandidate.FAIL)) {
                heur = heurCand;
            }
            if (laneCount > 0 || heur !== null || badLn) {
                highlightSegment(seg.geometry, direction, mapHighlights, applyLabels, fwdLaneCount, revLaneCount, lio && applyLioHighlight, csMode, badLn, heur, false);
            }
            // Nodes highlights
            if (mapHighlights && getId('lt-NodesEnable').checked) {
                if (tlns) {
                    highlightNode(node.geometry, `${LtSettings.NodeColor}`);
                }
                if (tio) {
                    highlightNode(node.geometry, `${LtSettings.TIOColor}`);
                }
            }
        }
        else {
            // Selected segment highlights
            lt_log(`candidate(f):${heurCand}`);
            if (heurCand !== HeuristicsCandidate.NONE) {
                if (entrySeg != null && (segments.findIndex(element => element === entrySeg.seg) > -1)) {
                    let nodeColor = heurCand === HeuristicsCandidate.PASS ? `${LtSettings.NodeColor}` : `${LtSettings.HeurFailColor}`;
                    highlightSegment(seg.geometry, direction, false, false, 0, 0, false, csMode, badLn, heurCand, true);
                    highlightSegment(entrySeg.seg.geometry, entrySeg.direction, false, false, 0, 0, false, 0, false, heurCand, true);
                    highlightNode(node.geometry, nodeColor, true);
                    highlightNode(oppNode.geometry, nodeColor, true);
                }
            }
        }
        return tryRedo;
    }
}

function checkLanesConfiguration(s, node, segs, numLanes) {
    let tlns = false;
    let tio = false;
    let badLn = false;
    let lio = false;
    let csMode = 0;
    let csStreet = null;
    let turnLanes = [];
    const turnGraph = W.model.getTurnGraph();
    const zoomLevel = W.map.getZoom() != null ? W.map.getZoom() : 16;

    for (let i = 0; i < segs.length; i++) {
        const seg2 = getSegObj(segs[i]);
        const turnData = turnGraph.getTurnThroughNode(node, s, seg2).getTurnData();
        if (turnData.state === 1) {
            // Check for turn instruction override
            if (turnData.hasInstructionOpcode()) {
                tio = true;
            }
            // Check for lanes
            if (turnData.hasLanes()) {
                tlns = true;
                // Check for lane angle override
                if (turnData.getLaneData().hasOverrideAngle()) {
                    lio = true;
                }
                // Check for Continue Straight override
                // 1 is for view only, 2 is for view and hear
                if (turnData.getLaneData().getGuidanceMode() === 1) {
                    csMode = 1;
                    csStreet = W.model.streets.getObjectById(seg2.attributes.primaryStreetID).name;
                } else if (turnData.getLaneData().getGuidanceMode() === 2) {
                    csMode = 2;
                    csStreet = W.model.streets.getObjectById(seg2.attributes.primaryStreetID).name;
                }

                const fromLns = turnData.lanes.fromLaneIndex;
                const toLns = turnData.lanes.toLaneIndex;
                for (let k = fromLns; k < toLns + 1; k++) {
                    let newValue = true;
                    for (let j = 0; j < turnLanes.length; j++) {
                        if (turnLanes[j] === k) {
                            newValue = false;
                        }
                    }
                    if (newValue) {
                        turnLanes.push(k);
                    }
                }
            }
        }
    }
    turnLanes.sort();
    for (let z = 0; z < turnLanes.length; z++) {
        if (turnLanes[z] !== z) {
            badLn = true;
        }
    }
    if (turnLanes.length < numLanes && onScreen(node, zoomLevel)) {
        badLn = true;
    }
    return [tlns, tio, lio, badLn, csMode, csStreet];
}

function setTurns(direction) {
    if (!getId('lt-ClickSaveEnable').checked) {
        return;
    }
    let lanesPane = document.getElementsByClassName(direction)[0];
    let left = (lanesPane.getElementsByClassName('angle--135').length > 0 ? 'angle--135' :
                (lanesPane.getElementsByClassName('angle--90').length > 0 ? 'angle--90' : 'angle--45'));
    let right = (lanesPane.getElementsByClassName('angle-135').length > 0 ? 'angle-135' :
                 (lanesPane.getElementsByClassName('angle-90').length > 0 ? 'angle-90' : 'angle-45'));

    let turnSections = lanesPane.getElementsByClassName('turn-lane-edit-top');
    let setLeft = false;
    let setRight = false;
    let alreadySet = [].slice.call(turnSections).reduce((acc, turn) => acc + [].slice.call(turn.getElementsByTagName('input')).reduce((acc, input) => (input.checked === true ? acc + 1 : acc), 0), 0);
    if (alreadySet === 0) {
        for (let i = 0; i < turnSections.length; i++) {
            const turnSection = turnSections[i];

            // Check if the lanes are already set. If already set, don't change anything.
            let laneCheckboxes = turnSection.getElementsByTagName('wz-checkbox');
            if (laneCheckboxes && laneCheckboxes.length > 0) {
                if (turnSection.getElementsByClassName(left).length > 0 &&
                    laneCheckboxes[0].checked !== undefined &&
                    laneCheckboxes[0].checked === false &&
                    getId('lt-ClickSaveTurns').checked) {
                    setLeft = true;
                    laneCheckboxes[0].click();
                } else if (turnSection.getElementsByClassName(right).length > 0 &&
                           laneCheckboxes[laneCheckboxes.length - 1].checked !== undefined &&
                           laneCheckboxes[laneCheckboxes.length - 1].checked === false &&
                           getId('lt-ClickSaveTurns').checked) {
                    setRight = true;
                    laneCheckboxes[laneCheckboxes.length - 1].click();
                }
            }
        }

        for (let i = 0; i < turnSections.length; i++) {
            const turnSection = turnSections[i];

            let laneCheckboxes = turnSection.getElementsByTagName('wz-checkbox');
            if (turnSection.getElementsByClassName('angle-0').length > 0) {
                // Set all lanes for straight turns
                for (let j = 0; j < laneCheckboxes.length; j++) {
                    if (laneCheckboxes[j].checked === false) {
                        if (j === 0 && (getId('lt-ClickSaveStraight').checked || setLeft === false)) {
                            laneCheckboxes[j].click();
                        } else if (j === (laneCheckboxes.length - 1) && (getId('lt-ClickSaveStraight').checked || setRight === false)) {
                            laneCheckboxes[j].click();
                        } else if (j !== 0 && j !== (laneCheckboxes.length - 1)) {
                            laneCheckboxes[j].click();
                        }
                    }
                }
            }
        }
    }
}

function initLaneGuidanceClickSaver() {
    let laneObserver = new MutationObserver((mutations) => {
        if (W.selectionManager.getSelectedFeatures()[0] &&
            W.selectionManager.getSelectedFeatures()[0].model.type === 'segment' &&
            getId('lt-ScriptEnabled').checked) {
            let laneCountInput = document.getElementsByName('laneCount');
            for (let i = 0; i < laneCountInput.length; i++) {
                laneCountInput[i].addEventListener('change', function () {
                    // wait for the input to appear
                    let parent = $(this).parents().eq(9);
 //                   let direction = parent[0].className;
                    let direction = parent[0].parentElement.className;
                    setTimeout(setTurns(direction), 50);
                }, false);
            }

            let laneToolsButtons = document.getElementsByClassName('lt-add-lanes');
            for (let i = 0; i < laneToolsButtons.length; i++) {
                laneToolsButtons[i].addEventListener('click', function () {
                    // wait for the input to appear
                    let parent = $(this).parents().eq(9);
 //                   let direction = parent[0].className;
                    let direction = parent[0].parentElement.className;
                    setTimeout(setTurns(direction), 50);
                }, false);
            }
        }
    });

    laneObserver.observe(document.getElementById('edit-panel'), {
        childList: true,
        subtree: true
    });
    // console.log('LaneTools: Click Saver Module loaded');
}

function isHeuristicsCandidate(segCandidate, curNodeExit, nodeExitSegIds, curNodeEntry, laneCount, segLength, turnGraph, inSegRef) {
    /* CRITERIA FOR HEURISTICS, as described on the wiki: https://wazeopedia.waze.com/wiki/USA/User:Nzahn1/Lanes#Mapping_lanes_on_divided_roadways
    1. Both left and right turns are possible at the intersection;
    2. The two portions of the divided roadway are essentially parallel to each other;
    3. The two intersecting roads are more or less perpendicular to each other;
    4. The median segment in question is 50 m or shorter; and
    5. The number of lanes entering the intersection is equal to the total number of lanes exiting the intersection
         (total number of lanes exiting intersection = number of lanes on the median segment +
            number of right-turn only lanes on the entry segment --  other words, no new lanes are added in the median).

    MY OBSERVATIONS
    11. We must have an incoming segment supplemenatary to outgoing segment 1.  (alt-incoming)
    12. That alt-incoming segment must be within perpendicular tolerance to BOTH the median segment and the incoming segment.
    */

    if (segCandidate == null || curNodeExit == null || nodeExitSegIds == null || curNodeEntry == null || laneCount == null || turnGraph == null || inSegRef == null) {
        lt_log('isHeuristicsCandidate received bad argument (null)', 1);
        return 0;
    }

    let outSeg2 = null;
    let outTurnAngle2 = null;
    let outSeg2IsHeurFail = 0;

    let inSeg = null;
    let inAzm = null;
    let inTurnAngle = null;
    let inSegIsHeurFail = 0;

    let altIncomingSeg = null;
    let altInAzm = null;
    let altInIsHeurFail = 0;

    let inNumLanesThrough = 0;

    // #4 first: Check the length (and get outta' here if not)
    //  1/1/21: This is now redundant with outer loop. But leaving it in just in case...
    if (segLength > MAX_LEN_HEUR) {
        return 0;
    }

    // Get current segment heading at the node
    const segId = segCandidate.attributes.id;
    let segEndAzm = lt_getMathAzimuth_to_node(curNodeExit.attributes.id, segCandidate);
    let segBeginAzm = lt_getMathAzimuth_from_node(curNodeEntry.attributes.id, segCandidate);

    let out1TargetAngle = -90.0; // For right-hand side of the road countries  (right-turn)
    let out2TargetAngle = 90.0; // (left-turn)
    if (W.model.isLeftHand) {
        out1TargetAngle = 90.0; // left turn
        out2TargetAngle = -90.0; // right turn
    }

    lt_log('==================================================================================', 2);
    lt_log(`Checking heuristics candidate: seg ${segId} node ${curNodeExit.attributes.id} azm ${segEndAzm} nodeExitSegIds:${nodeExitSegIds.length}`, 2);

    // Find the incoming segment, and validate angle to cursegment
    let nodeEntrySegIds = curNodeEntry.getSegmentIds();
    for (let ii = 0; ii < nodeEntrySegIds.length; ii++) {
        let thisTimeFail = 0;
        if (nodeEntrySegIds[ii] === segId) {
            continue;
        } // ignore same segment as our original
        const is = getSegObj(nodeEntrySegIds[ii]);
        // Check turn from this seg to candidate seg
        if (!lt_is_turn_allowed(is, curNodeEntry, segCandidate)) {
            continue;
        }

        let ia = lt_getMathAzimuth_to_node(curNodeEntry.attributes.id, is); // absolute math azimuth
        let ita = lt_turn_angle(ia, segBeginAzm); // turn angle
        lt_log(`Turn angle from inseg ${nodeEntrySegIds[ii]}: ${ita}(${ia},${segBeginAzm})`, 3);

        if (Math.abs(ita) > MAX_STRAIGHT_DIF) { // tolerance met?
            if (Math.abs(ita) > MAX_STRAIGHT_TO_CONSIDER) {
                continue;
            }
            lt_log(`   Not eligible as inseg: ${ita}`, 2);
            thisTimeFail = HeuristicsCandidate.FAIL;
        }

        const turnThrough = turnGraph.getTurnThroughNode(curNodeEntry, is, segCandidate);
        const turnData = turnThrough.getTurnData();
        if (turnData.state !== 1 || (!turnData.hasLanes())) {
            lt_log(`Straight turn has no lanes:${nodeEntrySegIds[ii]} to ${segId}`, 3);
            continue; // No lanes? Don't even think about it. (Not a candidate)
        }

        // #5 Ensure this (straight) turn motion has lanes, and lane count matches; otherwise ERROR
        //  1/1/21: One exception. If laneCount is 0, and there is exactly 1 straight incoming lane, then treat it as equal. (Conversation with @jm6087)
        let nl = turnData.lanes.toLaneIndex - turnData.lanes.fromLaneIndex + 1;
        if ((nl !== laneCount) && !(laneCount === 0 && nl === 1)) {
            lt_log('Straight turn lane count does not match', 2);
            thisTimeFail = HeuristicsCandidate.ERROR; // Failed lane match should give us an ERROR
        }

        // Only one segment allowed  // TBD ???    For now, don't allow more than one.
        if (inSeg !== null && thisTimeFail >= inSegIsHeurFail) {
            if (inSegIsHeurFail === 0 && thisTimeFail === 0) {
                lt_log(`Error: >1 qualifying entry segment for ${segCandidate.attributes.id}: ${inSeg.attributes.id},${is.attributes.id}`, 2);
                lt_log('==================================================================================', 2);
                return 0; // just stop here
            }
        }

        inSeg = is;
        inAzm = ia;
        inTurnAngle = ita;
        inNumLanesThrough = nl;
        inSegIsHeurFail = thisTimeFail;
        inSegRef.inSeg = inSeg;
        inSegRef.inSegDir = turnThrough.fromVertex.direction === 'fwd' ? Direction.FORWARD : Direction.REVERSE;
    }
    if (inSeg == null) {
        lt_log('== No inseg found ==================================================================', 2);
        return 0; // otherwise wait for later
    } else {
        lt_log(`Found inseg candidate: ${inSeg.attributes.id} ${(inSegIsHeurFail === 0) ? '' : '(failed)'}`, 2);
    }

    // #3(a) Determine the outgoing segment 2 (the 2nd turn) and validate turn angle
    for (let ii = 0; ii < nodeExitSegIds.length; ii++) {
        let thisTimeFail = 0;
        if (nodeExitSegIds[ii] === segId) {
            continue;
        } // ignore same segment as our original
        const os = getSegObj(nodeExitSegIds[ii]);

        // Check turn from candidate seg to this seg
        if (!lt_is_turn_allowed(segCandidate, curNodeExit, os)) {
            continue;
        }

        let oa = lt_getMathAzimuth_from_node(curNodeExit.attributes.id, os); // absolute math azimuth
        let ota = lt_turn_angle(segEndAzm, oa); // turn angle
        lt_log(`Turn angle to outseg2 ${nodeExitSegIds[ii]}: ${ota}(${segEndAzm},${oa})`, 2);

        // Just to be sure, we can't do Heuristics if there's a chance to turn right (RH)
        if (Math.abs(out1TargetAngle - ota) < MAX_PERP_TO_CONSIDER) { // tolerance met?
            return 0;
        }

        // Ok now check our turn angle
        if (Math.abs(out2TargetAngle - ota) > MAX_PERP_DIF) { // tolerance met?
            if (Math.abs(out2TargetAngle - ota) > MAX_PERP_TO_CONSIDER) {
                continue;
            } // too far out of tolerance to care (don't consider it a candidate at all)
            lt_log(`   Not eligible as outseg2: ${ota}`, 2);
            thisTimeFail = HeuristicsCandidate.FAIL;
        }

        // Only one segment allowed  // TBD ???    For now, don't allow more than one.
        if (outSeg2 !== null && thisTimeFail >= outSeg2IsHeurFail) {
            if (outSeg2IsHeurFail === 0 && thisTimeFail === 0) {
                lt_log(`Error: >1 qualifying exit2 segment for ${segCandidate.attributes.id}: ${outSeg2.attributes.id},${os.attributes.id}`, 2);
                lt_log('==================================================================================', 2);
                return 0; // just stop here
            }
        }

        outSeg2 = os;
        outTurnAngle2 = ota;
        outSeg2IsHeurFail = thisTimeFail;
    }
    if (outSeg2 == null) {
        lt_log('== No Outseg2 found ==================================================================', 2);
        return 0;
    } else {
        lt_log(`Found outseg2 candidate: ${outSeg2.attributes.id} ${(outSeg2IsHeurFail === 0) ? '' : '(failed)'}`, 2);
    }

    // #11 & 12: The Segment 1 that matters is the incoming (parallel to outgoing seg2)
    for (let ii = 0; ii < nodeEntrySegIds.length; ii++) {
        if (nodeEntrySegIds[ii] === segId || nodeEntrySegIds[ii] === inSeg.attributes.id) {
            // ignore same segment as our original
            continue;
        }
        const ai1 = getSegObj(nodeEntrySegIds[ii]);
        let thisTimeFail = 0;


        // Ensure the segment is one-way TOWARD the node (incoming direction)
        if ((ai1.attributes.fwdDirection && ai1.attributes.toNodeID !== curNodeEntry.attributes.id)
            || (ai1.attributes.revDirection && ai1.attributes.fromNodeID !== curNodeEntry.attributes.id)) {
            continue;
        }

        // Check turn from this seg to our segment
        let ia = lt_getMathAzimuth_to_node(curNodeEntry.attributes.id, ai1); // absolute math azimuth

        // 12. Check angle from inseg to this seg (se)
        //  Since we already have azm of this seg TOWARD the node, just check the supplementary turn angle. Must also be within tolerance. (See Geometry proof :)
        let tta = lt_turn_angle(inAzm, ia);
        lt_log(`Turn angle from inseg (supplementary) ${nodeEntrySegIds[ii]}: ${tta}(${inAzm},${ia})`, 3);
        if (Math.abs(out1TargetAngle - tta) > MAX_PERP_DIF_ALT) { // tolerance met?
            if (Math.abs(out1TargetAngle - tta) > MAX_PERP_TO_CONSIDER) {
                // too far out of tolerance to care (don't consider it a candidate at all)
                continue;
            }
            lt_log(`   Not eligible as altIn1: ${tta}`, 3);
            thisTimeFail = HeuristicsCandidate.FAIL;
        }

        // Only one segment allowed  // TBD ???    For now, don't allow more than one.
        if (altIncomingSeg !== null) {
            // If the new candidate is worse than what we already have, just move on
            if (thisTimeFail < altInIsHeurFail) {
                continue;
            }

            // If they both are good, then error
            if (altInIsHeurFail === 0 && thisTimeFail === 0) {
                lt_log(`Error: >1 qualifying segment for ${segCandidate.attributes.id}: ${altIncomingSeg.attributes.id},${ai1.attributes.id}`, 2);
                lt_log('==================================================================================', 2);
                return HeuristicsCandidate.FAIL;
            }

        } // If the new candidate is better than the old, then assign our candidate to the new one (below)

        altIncomingSeg = ai1;
        altInAzm = ia;
        altInIsHeurFail = thisTimeFail;
    }
    if (altIncomingSeg == null) {
        lt_log('== No alt incoming-1 segment found ==================================================================', 2);
        return 0;
    } else {
        lt_log(`Alt incoming-1 segment found: ${altIncomingSeg.attributes.id} ${(altInIsHeurFail === 0) ? '' : '(failed)'}`, 2);
    }

    // Have we found a failure candidate?
    if (inSegIsHeurFail < 0 || altInIsHeurFail < 0 || outSeg2IsHeurFail < 0) {
        lt_log(`Found a failed candidate for ${segId} ( ${Math.min(inSegIsHeurFail, altInIsHeurFail, outSeg2IsHeurFail)})`, 2);
        // NOTE: IF any seg is a FAIL, then return FAIL (not Error)
        if (inSegIsHeurFail === HeuristicsCandidate.FAIL || altInIsHeurFail === HeuristicsCandidate.FAIL || outSeg2IsHeurFail === HeuristicsCandidate.FAIL) {
            return HeuristicsCandidate.FAIL;
        } else {
            return HeuristicsCandidate.ERROR;
        }
    }

    // We have a winner!!!
    lt_log(`Found a heuristics candidate! ${segId} to ${outSeg2.attributes.id} at ${outTurnAngle2}`, 2);
    return 1;

    ////////////////////////////////////////////// end of func /////////////////////////////////////////////////////////

    // get the absolute angle for a segment at an end point - borrowed from JAI
    function lt_getMathAzimuth_from_node(nodeId, segment) {
        if (nodeId == null || segment == null) {
            return null;
        }
        let ja_dx, ja_dy;
        if (segment.attributes.fromNodeID === nodeId) {
            ja_dx = lt_get_second_point(segment).x - lt_get_first_point(segment).x;
            ja_dy = lt_get_second_point(segment).y - lt_get_first_point(segment).y;
        } else {
            ja_dx = lt_get_next_to_last_point(segment).x - lt_get_last_point(segment).x;
            ja_dy = lt_get_next_to_last_point(segment).y - lt_get_last_point(segment).y;
        }

        let angle_rad = Math.atan2(ja_dy, ja_dx);
        let angle_deg = ((angle_rad * 180 / Math.PI)) % 360;
        lt_log(`Azm from node ${nodeId} / ${segment.attributes.id}: ${angle_deg}`, 3);
        return angle_deg;
    }

    function lt_getMathAzimuth_to_node(nodeId, segment) {
        let fromAzm = lt_getMathAzimuth_from_node(nodeId, segment);
        let toAzm = fromAzm + 180.0;
        if (toAzm >= 180.0) {
            toAzm -= 360.0;
        }
        lt_log(`Azm to node ${nodeId} / ${segment.attributes.id}: ${toAzm}`, 3);
        return toAzm;
    }

    /** Get absolute angle between 2 inputs.
     * @param aIn absolute s_in angle (to node)
     * @param aOut absolute s_out angle (from node)
     * @returns {number}
     */
    function lt_turn_angle(aIn, aOut) {
        let angleInAdjusted = aIn;
        let angleOutAdjusted = aOut;
        while (aOut > 180.0) {
            angleOutAdjusted -= 360.0;
        }
        while (aOut < -180.0) {
            angleOutAdjusted += 360.0;
        }
        while (aIn > 180.0) {
            angleInAdjusted -= 360.0;
        }
        while (aIn < -180.0) {
            angleInAdjusted += 360.0;
        }

        let a = angleOutAdjusted - angleInAdjusted;
        a += (a > 180) ? -360 : (a < -180) ? 360 : 0;
        lt_log(`Turn ${angleInAdjusted},${angleOutAdjusted}: ${a}`, 3);
        return a;
    }

    function lt_is_turn_allowed(s_from, via_node, s_to) {
        lt_log(`Allow from ${s_from.attributes.id} to ${s_to.attributes.id} via ${via_node.attributes.id}? 
            ${via_node.isTurnAllowedBySegDirections(s_from, s_to)} | ${s_from.isTurnAllowed(s_to, via_node)}`, 3);

        // Is there a driving direction restriction?
        if (!via_node.isTurnAllowedBySegDirections(s_from, s_to)) {
            lt_log('Driving direction restriction applies', 3);
            return false;
        }

        // Is turn allowed by other means (e.g. turn restrictions)?
        if (!s_from.isTurnAllowed(s_to, via_node)) {
            lt_log('Other restriction applies', 3);
            return false;
        }

        // TBD: Do we need to consider restrictions?
        /*if(s_to.attributes.fromNodeID === via_node.attributes.id) {
            lt_log("FWD direction",3);
            return ja_is_car_allowed_by_restrictions(s_to.attributes.fwdRestrictions);
        } else {
            lt_log("REV direction",3);
            return ja_is_car_allowed_by_restrictions(s_to.attributes.revRestrictions);
        } */
        return true;
    }
}

// Segment Length - borrowed from JAI
function lt_segment_length(segment) {
    let len = segment.geometry.getGeodesicLength(window.W.map.olMap.projection);
    lt_log(`segment: ${segment.attributes.id} computed len: ${len} attrs len: ${segment.attributes.length}`, 3);
    return len;
}

function lt_log(lt_log_msg, lt_log_level = 1) {
    // ##NO_FF_START##
    // Firefox addons should not use console.(log|error|debug), so these lines
    // are removed by the FF addon packaging script.
    if (lt_log_level <= LANETOOLS_DEBUG_LEVEL) {
        console.log('LaneTools Dev Msg: ', lt_log_msg);
    }
    // ##NO_FF_END##
}

function copyLaneInfo(side) {
    _turnInfo = [];
    const selFeatures = W.selectionManager.getSelectedFeatures();
    const seg = selFeatures[0].model;
    const segAtt = seg.getFeatureAttributes();
    const segGeo = seg.geometry.components;
    const nodeID = side === 'A' ? segAtt.fromNodeID : segAtt.toNodeID;
    laneCount = side === 'A' ? segAtt.revLaneCount : segAtt.fwdLaneCount;

    console.log(laneCount);

    const node = getNodeObj(nodeID);
    const conSegs = node.getSegmentIds();
    const turnGraph = W.model.getTurnGraph();
    let geoPoint1;
    if (side === 'A') {
        geoPoint1 = segGeo[1];
    } else {
        geoPoint1 = segGeo[segGeo.length - 2];
    }

    let ja_dx = geoPoint1.x - node.geometry.x;
    let ja_dy = geoPoint1.y - node.geometry.y;
    let angleRad = Math.atan2(ja_dy, ja_dx);
    let angleDeg = ((angleRad * 180 / Math.PI)) % 360;

    for (let i = 0; i < conSegs.length; i++) {
        const seg2 = getSegObj(conSegs[i]);
        let seg2Att = seg2.getFeatureAttributes();
        let seg2Geo = seg2.geometry.components;
        let geoPoint2;
        let seg2Dir;
        let turnInfo = turnGraph.getTurnThroughNode(node, seg, seg2).getTurnData();

        if (turnInfo.state === 1 && turnInfo.lanes) {
            if (seg2Att.fromNodeID === nodeID) {
                seg2Dir = 'A';
            } else {
                seg2Dir = 'B';
            }
            if (seg2Dir === 'A') {
                geoPoint2 = seg2Geo[1];
            } else {
                geoPoint2 = seg2Geo[seg2Geo.length - 2];
            }

            ja_dx = geoPoint2.x - node.geometry.x;
            ja_dy = geoPoint2.y - node.geometry.y;
            angleRad = Math.atan2(ja_dy, ja_dx);

            let tempAngle = ((angleRad * 180 / Math.PI)) % 360;
            if (angleDeg < 0) tempAngle = angleDeg - tempAngle;

            _turnData = {};

            let laneData = turnInfo.getLaneData();
            _turnData.id = seg2.attributes.id;
            _turnData.order = tempAngle;
            _turnData.lanes = laneData;
            _turnInfo.push(_turnData);
        }
        _turnInfo.sort((a, b) => ((a.order > b.order) ? 1 : -1));
    }

    console.log(_turnInfo);
}

function pasteLaneInfo(side) {
    const mAction = new MultiAction();
    mAction.setModel(W.model);
    const selFeatures = W.selectionManager.getSelectedFeatures();
    const seg = selFeatures[0].model;
    const segGeo = seg.geometry.components;
    const segAtt = seg.getFeatureAttributes();
    const nodeID = side === 'A' ? segAtt.fromNodeID : segAtt.toNodeID;
    // let sortA = _cpyDir == side ? 1 : -1;
    // let sortB = _cpyDir == side ? -1 : 1;
    let geoPoint1;

    const node = getNodeObj(nodeID);
    const conSegs = node.getSegmentIds();
    const turnGraph = W.model.getTurnGraph();
    let pasteData = {};
    let pasteInfo = [];


    if (side === 'A') {
        geoPoint1 = segGeo[1];
    } else {
        geoPoint1 = segGeo[segGeo.length - 2];
    }

    let ja_dx = geoPoint1.x - node.geometry.x;
    let ja_dy = geoPoint1.y - node.geometry.y;
    let angleRad = Math.atan2(ja_dy, ja_dx);
    let angleDeg = ((angleRad * 180 / Math.PI)) % 360;

    for (let i = 0; i < conSegs.length; i++) {
        let seg2 = getSegObj(conSegs[i]);
        let seg2Att = seg2.attributes;
        let seg2Geo = seg2.geometry.components;
        let geoPoint2 = {};
        let seg2Dir;
        let turnInfo = turnGraph.getTurnThroughNode(node, seg, seg2).getTurnData();

        if (seg2Att.fromNodeID === nodeID) {
            seg2Dir = 'A';
        } else {
            seg2Dir = 'B';
        }
        if (seg2Dir === 'A') {
            geoPoint2 = seg2Geo[1];
        } else {
            geoPoint2 = seg2Geo[seg2Geo.length - 2];
        }

        if (turnInfo.state === 1) {
            pasteData = {};

            ja_dx = geoPoint2.x - node.geometry.x;
            ja_dy = geoPoint2.y - node.geometry.y;
            angleRad = Math.atan2(ja_dy, ja_dx);

            let tempAngle = ((angleRad * 180 / Math.PI)) % 360;
            if (angleDeg < 0) tempAngle = angleDeg - tempAngle

            pasteData.id = seg2Att.id;
            pasteData.order = tempAngle;
            pasteInfo.push(pasteData);
        }
        pasteInfo.sort((a, b) => ((a.order > b.order) ? 1 : -1));
    }


    console.log(pasteInfo);

    if (_turnInfo.length === pasteInfo.length) {
        if (side === 'A') {
            mAction.doSubAction(new UpdateObj(seg, { revLaneCount: laneCount }));
        } else {
            mAction.doSubAction(new UpdateObj(seg, { fwdLaneCount: laneCount }));
        }

        for (let k = 0; k < pasteInfo.length; k++) {
            let pasteTurn = {};
            // Copy turn data into temp object
            for (let q = 0; q < _turnInfo.length; q++) {
                pasteTurn[q] = _turnInfo[q];
            }
            // If pasting in the opposite direction, reverse the lane associations
            /* if (_cpyDir != side) {
                for (let z=0;z < pasteTurn.length; z++) {
                    pasteTurn[z].lanes.arrowAngle = pasteTurn[z].lanes.arrowAngle * -1;
                }
            } */

            let toSeg = getSegObj(pasteInfo[k].id);

            let turnStatus = turnGraph.getTurnThroughNode(node, seg, toSeg);
            let turnData = turnStatus.getTurnData();

            turnData = turnData.withLanes(pasteTurn[k].lanes);
            turnStatus = turnStatus.withTurnData(turnData);

            mAction.doSubAction(new SetTurn(turnGraph, turnStatus));
        }

        mAction._description = 'Pasted some lane stuff';
        W.model.actionManager.add(mAction);

        $('.lanes-tab').click();
    } else {
        WazeWrap.Alerts.warning(GM_info.script.name, 'There are a different number of enabled turns on this segment/node');
    }
}

function displayLaneGraphics() {
    removeLaneGraphics();
    const sel = W.selectionManager.getSelectedFeatures();

    if (!getId('lt-ScriptEnabled').checked || !getId('lt-IconsEnable').checked || sel.length !== 1 || sel[0].model.type !== 'segment')
        return;

    const seg = sel[0].model;
    const zoomLevel = W.map.getOLMap().getZoom();

    if ((seg.attributes.roadType !== (3 || 6 || 7) && zoomLevel < 16) || zoomLevel < 15) return;

    let fwdEle = seg.attributes.fwdLaneCount > 0 ? getIcons($('.fwd-lanes').find('.lane-arrow').map(function() { return this }).get()) : false;
    let revEle = seg.attributes.revLaneCount > 0 ? getIcons($('.rev-lanes').find('.lane-arrow').map(function() { return this }).get()) : false;


    //let fwdEle = seg.attributes.fwdLaneCount > 0 ? getIcons($('.fwd-lanes').find('svg').map(function() { return this }).get()) : false;
    //let revEle = seg.attributes.revLaneCount > 0 ? getIcons($('.rev-lanes').find('svg').map(function() { return this }).get()) : false;

    function getIcons(dir) {
        let tempEle = {};
        for (let i = 0; i < dir.length; i++) {
            //if (dir[i].id !== "") {
            let temp = {};
            temp['uturn'] = $(dir[i]).find('.uturn').css('display') !== 'none';
            temp['miniuturn'] = $(dir[i]).find('.small-uturn').css('display') !== 'none';
            temp['svg'] = $(dir[i]).find('svg').map(function() { return this }).get();
            tempEle[i] = temp;
            //}
        }
        return tempEle;
    }

    let fwdImgs = fwdEle != false ? convertToBase64(fwdEle) : false;
    let revImgs = revEle != false ? convertToBase64(revEle) : false;

    function convertToBase64(svgs) {
        const serial = new XMLSerializer();
        _.each(svgs, obj => {
            try{
                let svg = obj.svg[0];
                let tmp = serial.serializeToString(svg);
                obj['svg'] = 'data:image/svg+xml;base64,' + window.btoa(tmp);
            } catch(e) {
                // console.log(e);
                return;
            }
        });

        return svgs;
    }

    if (fwdEle) { drawIcons(W.model.nodes.getObjectById(seg.attributes.toNodeID), fwdImgs); }
    if (revEle) { drawIcons(W.model.nodes.getObjectById(seg.attributes.fromNodeID), revImgs); }

    function drawIcons(node, imgs) {
        let featDis = getFeatDistance();
        let deg = getCardinalAngle(node.attributes.id, seg);
        let centerPoint;
        let points = [];
        let operatorSign = 0;
        let numIcons = Object.getOwnPropertyNames(imgs).length;


        // Orient all icons straight up if the rotate option isn't enabled
        if (!getId('lt-IconsRotate').checked) deg = -90;

        // Rotate in the style is clockwise, the rotate() func is counterclockwise
        if (deg === 0) {
            deg += 180;
            operatorSign = 1
        } else if (deg > 0 && deg <= 30) {
            deg += 2* (90 - deg);
            // console.log('Math stuff2: ' + deg);
            operatorSign = 1
        } else if (deg >= 330 && deg <= 360) {
            deg -= (180 - (2 * (360 - deg)));
            // console.log('Math stuff2: ' + deg);
            operatorSign = 1
        } else if (deg > 30 && deg < 60) {
            deg -= (90 - (2 * (360 - deg)));
            // console.log('Math stuff3: ' + deg);
            operatorSign = 2;
        } else if (deg >= 60 && deg <= 120) {
            deg -= (90 - (2 * (360 - deg)));
            // console.log('Math stuff4: ' + deg);
            operatorSign = 2;
        } else if (deg > 120 && deg < 150) {
            deg -= (90 - (2 * (360 - deg)));
            // console.log('Math stuff5: ' + deg);
            operatorSign = 7;
        } else if (deg >= 150 && deg <= 210) {
            deg = (180 - deg);
            // console.log('Math stuff6: ' + deg);
            operatorSign = 4;
        } else if (deg > 210 && deg < 240) {
            deg -= (90 - (2 * (360 - deg)));
            // console.log('Math stuff7: ' + deg);
            operatorSign = 6;
        } else if (deg >= 240 && deg <= 300) {
            deg -= (180 - (2 * (360 - deg)));
            // console.log('Math stuff8: ' + deg);
            operatorSign = 3;
        } else if (deg > 300 && deg < 330) {
            deg -= (180 - (2 * (360 - deg)));
            // console.log('Math stuff9: ' + deg);
            operatorSign = 5;
        } else {
            console.log('LT: icon angle is out of bounds');
        }

        let iconRotate = deg > 315 ? deg : deg + 90;
        let boxRotate = 360 - iconRotate;

        // console.log(deg);
        // console.log(operatorSign);
        // Determine start point respective to node based on segment angle
        function getStartPoints(sign) {
            temp = {};
            if (UPDATEDZOOM){
                if (sign === 0) {
                    temp = {
                        x: node.geometry.x + (featDis.start * 2),
                        y: node.geometry.y + (featDis.boxheight)
                    }
                } else if (sign === 1) {
                    temp = {
                        x: node.geometry.x + featDis.boxheight,
                        y: node.geometry.y + (featDis.boxincwidth * numIcons/1.8)
                    }
                } else if (sign === 2) {
                    temp = {
                        x: node.geometry.x - (featDis.start + (featDis.boxincwidth * numIcons)),
                        y: node.geometry.y + (featDis.start + featDis.boxheight)
                    }
                } else if (sign === 3) {
                    temp = {
                        x: node.geometry.x + (featDis.start + featDis.boxincwidth),
                        y: node.geometry.y - (featDis.start + featDis.boxheight)
                    }
                } else if (sign === 4) {
                    temp = {
                        x: node.geometry.x - (featDis.start + (featDis.boxheight * 1.5)),
                        y: node.geometry.y - (featDis.start + (featDis.boxincwidth * numIcons * 1.5))
                    }
                } else if (sign === 5) {
                    temp = {
                        x: node.geometry.x + (featDis.start + featDis.boxincwidth/2),
                        y: node.geometry.y + (featDis.start/2)
                    }
                } else if (sign === 6) {
                    temp = {
                        x: node.geometry.x - (featDis.start),
                        y: node.geometry.y - (featDis.start * (featDis.boxincwidth * numIcons/2))
                    }
                } else if (sign === 7) {
                    temp = {
                        x: node.geometry.x - (featDis.start * (featDis.boxincwidth * numIcons/2)),
                        y: node.geometry.y - (featDis.start)
                    }
                }
            } else {
                if (sign === 0) {
                    temp = {
                        x: node.geometry.x + (featDis.start * 2),
                        y: node.geometry.y + (featDis.boxheight)
                    }
                } else if (sign === 1) {
                    temp = {
                        x: node.geometry.x + featDis.boxheight,
                        y: node.geometry.y + (featDis.boxincwidth * numIcons/1.8)
                    }
                } else if (sign === 2) {
                    temp = {
                        x: node.geometry.x - (featDis.start + (featDis.boxincwidth * numIcons)),
                        y: node.geometry.y + (featDis.start + featDis.boxheight)
                    }
                } else if (sign === 3) {
                    temp = {
                        x: node.geometry.x + (featDis.start + featDis.boxincwidth),
                        y: node.geometry.y - (featDis.start + featDis.boxheight * 2)
                    }
                } else if (sign === 4) {
                    temp = {
                        x: node.geometry.x - (featDis.start + (featDis.boxheight * 1.5)),
                        y: node.geometry.y - (featDis.start + (featDis.boxincwidth * numIcons * 1.5))
                    }
                } else if (sign === 5) {
                    temp = {
                        x: node.geometry.x + (featDis.start + featDis.boxincwidth/2),
                        y: node.geometry.y + (featDis.start/2)
                    }
                } else if (sign === 6) {
                    temp = {
                        x: node.geometry.x - (featDis.start),
                        y: node.geometry.y - (featDis.start * (featDis.boxincwidth * numIcons/2))
                    }
                } else if (sign === 7) {
                    temp = {
                        x: node.geometry.x - (featDis.start * (featDis.boxincwidth * numIcons/2)),
                        y: node.geometry.y - (featDis.start)
                    }
                }
            }
            return temp;
        }

        // let boxRotate = deg * -1;

        let startPoint = getStartPoints(operatorSign);

        // Box coords
        var boxPoint1 = new OpenLayers.Geometry.Point(startPoint.x, startPoint.y + featDis.boxheight);
        var boxPoint2 = new OpenLayers.Geometry.Point(startPoint.x + (featDis.boxincwidth * numIcons), startPoint.y + featDis.boxheight);
        var boxPoint3 = new OpenLayers.Geometry.Point(startPoint.x + (featDis.boxincwidth * numIcons), startPoint.y);
        var boxPoint4 = new OpenLayers.Geometry.Point(startPoint.x, startPoint.y);
        points.push(boxPoint1, boxPoint2, boxPoint3, boxPoint4);

        var boxStyle = {
            strokeColor: '#ffffff',
            strokeOpacity: 1,
            strokeWidth: 8,
            fillColor: '#ffffff'
        };

        let boxRing = new OpenLayers.Geometry.LinearRing(points);
        centerPoint = boxRing.getCentroid();
        boxRing.rotate(boxRotate, centerPoint);
        let boxVector = new OpenLayers.Feature.Vector(boxRing, null, boxStyle);

        LTLaneGraphics.addFeatures([boxVector]);

        let num = 0;
        _.each(imgs, img => {
            let iconPoints = [];
            // Icon Background
            var iconPoint1 = new OpenLayers.Geometry.Point(startPoint.x + (featDis.boxincwidth * num) + featDis.iconbordermargin, startPoint.y + featDis.iconborderheight);
            var iconPoint2 = new OpenLayers.Geometry.Point(startPoint.x + (featDis.boxincwidth * num) + featDis.iconborderwidth, startPoint.y + featDis.iconborderheight);
            var iconPoint3 = new OpenLayers.Geometry.Point(startPoint.x + (featDis.boxincwidth * num) + featDis.iconborderwidth, startPoint.y + featDis.iconbordermargin);
            var iconPoint4 = new OpenLayers.Geometry.Point(startPoint.x + (featDis.boxincwidth * num) + featDis.iconbordermargin, startPoint.y + featDis.iconbordermargin);
            iconPoints.push(iconPoint1, iconPoint2, iconPoint3, iconPoint4);

            var iconBoxStyle = {
                strokeColor: '#000000',
                strokeOpacity: 1,
                strokeWidth: 1,
                fillColor: '#26bae8'
            };

            let iconBoxRing = new OpenLayers.Geometry.LinearRing(iconPoints);
            iconBoxRing.rotate(boxRotate, centerPoint);
            let iconBoxVector = new OpenLayers.Feature.Vector(iconBoxRing, null, iconBoxStyle);

            LTLaneGraphics.addFeatures([iconBoxVector]);

            // Icon coords
            let arrowOrigin = iconBoxRing.getCentroid();
            let iconStart = new OpenLayers.Geometry.Point(arrowOrigin.x, arrowOrigin.y);
            let ulabel = '';
            let usize = {
                x: 0,
                y: 0
            }
            let uoffset = {
                x: 0,
                y: 0
            }
            if (img['uturn'] === true) {
                ulabel = 'https://editor-assets.waze.com/production/font/aae5ed152758cb6a9191b91e6cedf322.svg';
                usize.x = 0.6;
                usize.y = 0.6;
                uoffset.x = -7;
                uoffset.y = -12;
            }
            if (img['miniuturn'] === true) {
                ulabel = 'https://editor-assets.waze.com/production/font/aae5ed152758cb6a9191b91e6cedf322.svg';
                usize.x = 0.3;
                usize.y = 0.25;
                uoffset.x = -8;
                uoffset.y = 4;
            }

            let iconStyle = {
                externalGraphic: img['svg'],
                graphicHeight: featDis.graphicHeight,
                graphicWidth: featDis.graphicWidth,
                fillColor: '#26bae8',
                bgcolor: '#26bae8',
                color: '#26bae8',
                rotation: iconRotate,
                backgroundGraphic: ulabel,
                backgroundHeight: featDis.graphicHeight * usize.y,
                backgroundWidth: featDis.graphicWidth * usize.x,
                backgroundXOffset: uoffset.x,
                backgroundYOffset: uoffset.y
            };

            // Add icon to map
            let iconFeature = new OpenLayers.Feature.Vector(iconStart, null, iconStyle);
            LTLaneGraphics.addFeatures([iconFeature]);
            num++;
        });
        LTLaneGraphics.setZIndex(600); 
    }

    // There are now 23 zoom levels where 22 is fully zoomed and currently 14 is where major road types load data and 16 loads the rest
    function getFeatDistance() {
        var label_distance = {};
        if (UPDATEDZOOM) {
            switch (W.map.getOLMap().getZoom()) {
                case 22:
                    label_distance.start = .5;
                    label_distance.boxheight = 1.7;
                    label_distance.boxincwidth = 1.1;
                    label_distance.iconbordermargin = .1;
                    label_distance.iconborderheight = 1.6;
                    label_distance.iconborderwidth = 1;
                    label_distance.graphicHeight = 42;
                    label_distance.graphicWidth = 25;
                    break;
                case 21:
                    label_distance.start = 1;
                    label_distance.boxheight = 3.2;
                    label_distance.boxincwidth = 2.2;
                    label_distance.iconbordermargin = .2;
                    label_distance.iconborderheight = 3;
                    label_distance.iconborderwidth = 2;
                    label_distance.graphicHeight = 42;
                    label_distance.graphicWidth = 25;
                    break;
                case 20:
                    label_distance.start = 2;
                    label_distance.boxheight = 5.2;
                    label_distance.boxincwidth = 3.8;
                    label_distance.iconbordermargin = .3;
                    label_distance.iconborderheight = 4.9;
                    label_distance.iconborderwidth = 3.5;
                    label_distance.graphicHeight = 42;
                    label_distance.graphicWidth = 25;
                    break;
                case 19:
                    label_distance.start = 3;
                    label_distance.boxheight = 10.0;
                    label_distance.boxincwidth = 7.2;
                    label_distance.iconbordermargin = .4;
                    label_distance.iconborderheight = 9.6;
                    label_distance.iconborderwidth = 6.8;
                    label_distance.graphicHeight = 42;
                    label_distance.graphicWidth = 25;
                    break;
                case 18:
                    label_distance.start = 6;
                    label_distance.boxheight = 20.0;
                    label_distance.boxincwidth = 14.0;
                    label_distance.iconbordermargin = .5;
                    label_distance.iconborderheight = 19.5;
                    label_distance.iconborderwidth = 13.5;
                    label_distance.graphicHeight = 42;
                    label_distance.graphicWidth = 25;
                    break;
                case 17:
                    label_distance.start = 10;
                    label_distance.boxheight = 39.0;
                    label_distance.boxincwidth = 28.0;
                    label_distance.iconbordermargin = 1.0;
                    label_distance.iconborderheight = 38.0;
                    label_distance.iconborderwidth = 27.0;
                    label_distance.graphicHeight = 42;
                    label_distance.graphicWidth = 25;
                    break;
                case 16:
                    label_distance.start = 15;
                    label_distance.boxheight = 80.0;
                    label_distance.boxincwidth = 55;
                    label_distance.iconbordermargin = 2.0;
                    label_distance.iconborderheight = 78.0;
                    label_distance.iconborderwidth = 53;
                    label_distance.graphicHeight = 42;
                    label_distance.graphicWidth = 25;
                    break;
                case 15:
                    label_distance.start = 2;
                    label_distance.boxheight = 120.0;
                    label_distance.boxincwidth = 90;
                    label_distance.iconbordermargin = 3.0;
                    label_distance.iconborderheight = 117.0;
                    label_distance.iconborderwidth = 87;
                    label_distance.graphicHeight = 42;
                    label_distance.graphicWidth = 25;
                    break;
                case 14:
                    label_distance.start = 2;
                    label_distance.boxheight = 5.2;
                    label_distance.boxincwidth = 3.8;
                    label_distance.iconbordermargin = .3;
                    label_distance.iconborderheight = 4.9;
                    label_distance.iconborderwidth = 3.5;
                    label_distance.graphicHeight = 42;
                    label_distance.graphicWidth = 25;
                    break;
                    // case 13:
                    //     label_distance.start = 2;
                    //     label_distance.boxheight = 5.2;
                    //     label_distance.boxincwidth = 3.8;
                    //     label_distance.iconbordermargin = .3;
                    //     label_distance.iconborderheight = 4.9;
                    //     label_distance.iconborderwidth = 3.5;
                    //     label_distance.graphicHeight = 42;
                    //     label_distance.graphicWidth = 25;
                    //     break;
            }
        } else {
            switch (W.map.getOLMap().getZoom()) {
                case 10:
                    label_distance.start = .5;
                    label_distance.boxheight = 1.7;
                    label_distance.boxincwidth = 1.1;
                    label_distance.iconbordermargin = .1;
                    label_distance.iconborderheight = 1.6;
                    label_distance.iconborderwidth = 1;
                    label_distance.graphicHeight = 42;
                    label_distance.graphicWidth = 25;
                    break;
                case 9:
                    label_distance.start = 1;
                    label_distance.boxheight = 3.2;
                    label_distance.boxincwidth = 2.2;
                    label_distance.iconbordermargin = .2;
                    label_distance.iconborderheight = 3;
                    label_distance.iconborderwidth = 2;
                    label_distance.graphicHeight = 42;
                    label_distance.graphicWidth = 25;
                    break;
                case 8:
                    label_distance.start = 2;
                    label_distance.boxheight = 5.2;
                    label_distance.boxincwidth = 3.8;
                    label_distance.iconbordermargin = .3;
                    label_distance.iconborderheight = 4.9;
                    label_distance.iconborderwidth = 3.5;
                    label_distance.graphicHeight = 42;
                    label_distance.graphicWidth = 25;
                    break;
                case 7:
                    label_distance.start = 3;
                    label_distance.boxheight = 10.0;
                    label_distance.boxincwidth = 7.2;
                    label_distance.iconbordermargin = .4;
                    label_distance.iconborderheight = 9.6;
                    label_distance.iconborderwidth = 6.8;
                    label_distance.graphicHeight = 42;
                    label_distance.graphicWidth = 25;
                    break;
                case 6:
                    label_distance.start = 6;
                    label_distance.boxheight = 20.0;
                    label_distance.boxincwidth = 14.0;
                    label_distance.iconbordermargin = .5;
                    label_distance.iconborderheight = 19.5;
                    label_distance.iconborderwidth = 13.5;
                    label_distance.graphicHeight = 42;
                    label_distance.graphicWidth = 25;
                    break;
                case 5:
                    label_distance.start = 10;
                    label_distance.boxheight = 40.0;
                    label_distance.boxincwidth = 29.0;
                    label_distance.iconbordermargin = 1.0;
                    label_distance.iconborderheight = 38.0;
                    label_distance.iconborderwidth = 27.0;
                    label_distance.graphicHeight = 42;
                    label_distance.graphicWidth = 25;
                    break;
                case 4:
                    label_distance.start = 15;
                    label_distance.boxheight = 80.0;
                    label_distance.boxincwidth = 55;
                    label_distance.iconbordermargin = 2.0;
                    label_distance.iconborderheight = 78.0;
                    label_distance.iconborderwidth = 53;
                    label_distance.graphicHeight = 42;
                    label_distance.graphicWidth = 25;
                    break;
                case 3:
                    label_distance.start = 2;
                    label_distance.boxheight = 120.0;
                    label_distance.boxincwidth = 90;
                    label_distance.iconbordermargin = 3.0;
                    label_distance.iconborderheight = 117.0;
                    label_distance.iconborderwidth = 87;
                    label_distance.graphicHeight = 42;
                    label_distance.graphicWidth = 25;
                    break;
                case 2:
                    label_distance.start = 2;
                    label_distance.boxheight = 5.2;
                    label_distance.boxincwidth = 3.8;
                    label_distance.iconbordermargin = .3;
                    label_distance.iconborderheight = 4.9;
                    label_distance.iconborderwidth = 3.5;
                    label_distance.graphicHeight = 42;
                    label_distance.graphicWidth = 25;
                    break;
                case 1:
                    label_distance.start = 2;
                    label_distance.boxheight = 5.2;
                    label_distance.boxincwidth = 3.8;
                    label_distance.iconbordermargin = .3;
                    label_distance.iconborderheight = 4.9;
                    label_distance.iconborderwidth = 3.5;
                    label_distance.graphicHeight = 42;
                    label_distance.graphicWidth = 25;
                    break;
            }
        }
        return label_distance;
    }

}

laneToolsBootstrap();
