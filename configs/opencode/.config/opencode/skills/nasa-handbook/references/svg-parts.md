# SVG parts library

Copy-paste parts for handbook figures. Units are millimetres on paper: figures
use `viewBox="0 0 180 H"` and fill the 179 mm text column, so `H` is the
figure's height in mm. Classes and the `nh-*` markers and patterns come from
`assets/template.html`. The examples in `assets/examples/` use all of
these parts in context; search them for the part name.

Coordinates below are examples. Move them, but keep the sizes. When a part
must rise above the figure's first row (a breaker handle, a chart title),
start the viewBox at a negative y, `viewBox="0 -3.6 180 50"`, instead of
shifting everything down.

## Contents

- Structure: figure shell, box, panel, adjoining panels, drum, sealed drum, bracket, figure code, detail inset
- Wiring: wire, arrow, two-way arrow, junction, crossover hop, bus fan-out, wire label
- Period symbols: circuit breaker, selector switch, pushbutton, talkback, hex terminal, coil, capacitor, capacitor bank, ground, relay contacts and coil, fuse, resistor
- Panel front view: grid references, toggle, rotary selector, keycap, display window, indicator lamp
- Drafting: callout and leader, side label, dimensions, centerline, hidden line, section cut, section view, glass, axes
- Time and data: timeline axis and ticks, broken axis, lanes and bars, events, staggered event labels, markers, legend, sequence detail, parts strip
- Fluid and instruments: check valve, valve with actuator, pump, heat exchanger, radiator, blower, membrane, flexible hose, gauge, sensor, station tags and station data, granular fill
- Charts: axes, ticks, axis titles, a computed curve, reference lines, marked points, process path

## Structure

Figure shell (caption and code included):

```html
<figure>
  <svg viewBox="0 0 180 66" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="What the figure shows">
    <!-- parts -->
    <text class="code" x="178.6" y="65.4" text-anchor="end">TLM-501A</text>
  </svg>
  <figcaption><span class="n">Figure 2.1-1.</span>Recording System Functional Diagram</figcaption>
</figure>
```

Box with a title and up to three detail lines (title 2.35, details 2.05, about
2.7 mm apart; centre the block vertically):

```html
<rect class="box" x="85" y="7" width="28" height="15"/>
<text class="lbl"   x="99" y="11"   text-anchor="middle">TELEMETRY ROUTER</text>
<text class="lbl-s" x="99" y="14.2" text-anchor="middle">SESSIONS, ROUTES</text>
<text class="lbl-s" x="99" y="16.8" text-anchor="middle">STATION CLOCK</text>
<text class="lbl-s" x="99" y="19.4" text-anchor="middle">ACCESS TOKENS (SIGNED)</text>
```

Width guide for Routed Gothic Narrow: about 1.2 mm per character at 2.35 and
1.05 mm at 2.05. Leave at least 1.5 mm between text and a box edge.

Dashed panel (a runtime, device or trust boundary) with its name inside, top left:

```html
<rect class="panel" x="1.5" y="2.5" width="77" height="64.5"/>
<text class="lbl-s" x="3.4" y="5.6">FIELD STATION (1 OF ≤ 8)</text>
```

Adjoining panels share one edge: draw the second as a path that leaves out
the shared side. Otherwise keep a channel of 3 mm or more between them:

```html
<rect class="panel" x="1.5" y="2.5" width="40" height="26"/>
<path class="panel" d="M41.5,2.5 H81.5 V28.5 H41.5"/>
<text class="lbl-s" x="3.4" y="5.6">CLIENT</text>
<text class="lbl-s" x="43.4" y="5.6">SERVER</text>
```

Drum (storage: a database, bucket or disk). Body path, then the top ellipse
drawn over it:

```html
<path class="box" d="M120,31 L120,44.6 A8.5,1.8 0 0 0 137,44.6 L137,31"/>
<ellipse class="box" cx="128.5" cy="31" rx="8.5" ry="1.8"/>
<text class="lbl-b" x="128.5" y="36.6" text-anchor="middle">ARCHIVE</text>
<text class="lbl-s" x="128.5" y="39.4" text-anchor="middle">OBJECT STORE</text>
```

Sealed or encrypted drum: the same drum with a hatched lid, plus a legend
swatch. Hatching still means one thing per page, so don't also use it for cut
faces or video bars:

```html
<path class="box" d="M10,27 L10,37 A8.5,1.8 0 0 0 27,37 L27,27"/>
<ellipse class="box hatch" cx="18.5" cy="27" rx="8.5" ry="1.8"/>
<text class="lbl-b" x="18.5" y="32.4" text-anchor="middle">VAULT</text>
<text class="lbl-s" x="18.5" y="35.2" text-anchor="middle">AES-256</text>
<ellipse class="box hatch" cx="34" cy="31" rx="3" ry="1.1"/>
<text class="lbl-s" x="38.4" y="31.75">ENCRYPTED AT REST</text>
```

Bracket grouping a row of parts, with its label above:

```html
<polyline class="w" points="24,14.4 24,13.2 75,13.2 75,14.4"/>
<text class="lbl-s" x="49.5" y="12.2" text-anchor="middle">ENCODER CHAIN (ONE PER STATION)</text>
```

Detail inset on the right of a secondary figure, after a thin divider:

```html
<line class="t" x1="123.4" y1="-0.6" x2="123.4" y2="47.6"/>
<text class="lbl-b" x="126" y="2">DETAIL A: CLOCK SYNC</text>
```

## Wiring

```html
<line class="wa" x1="113" y1="35" x2="119.6" y2="35"/>            <!-- arrow; stop 0.4 short of the target edge -->
<polyline class="wa" points="75,55.4 79.8,55.4 79.8,35 84.6,35"/>   <!-- routed wire, right angles only -->
<line class="w" x1="22" y1="10.5" x2="42" y2="10.5"/>               <!-- plain wire -->
<circle class="dot" cx="42" cy="10.5" r="0.55"/>                    <!-- junction: wires join here -->
<text class="lbl-s" x="114" y="34.2">PART</text>                     <!-- wire name: 0.8 above the wire, near its start -->
<text class="lbl-s" transform="translate(82.1 52.6) rotate(-90)">4 MB BLOCKS</text>  <!-- on a vertical wire -->
```

Two-way arrow: `nh-arrow` and `nh-leader` are `auto-start-reverse`, so the
same marker at the start points back. Stop 0.4 short at both ends:

```html
<line class="wa" style="marker-start: url(#nh-arrow)" x1="130.4" y1="12" x2="169.6" y2="12"/>
<text class="lbl-s" x="150" y="11.2" text-anchor="middle">SYNC</text>
```

Crossover hop: a wire that crosses another without joining jumps it with a
1.1 mm half circle. A joint keeps its junction dot:

```html
<line class="w" x1="160" y1="4" x2="160" y2="22"/>
<path class="w" d="M150,10 H158.9 A1.1,1.1 0 0 1 161.1,10 H172"/>  <!-- crosses -->
<line class="w" x1="150" y1="17" x2="172" y2="17"/>
<circle class="dot" cx="160" cy="17" r="0.55"/>                       <!-- joins -->
```

Bus fan-out (one source feeding a column of boxes):

```html
<line class="w" x1="137" y1="37.5" x2="142.5" y2="37.5"/>
<line class="w" x1="142.5" y1="11.5" x2="142.5" y2="50.5"/>
<circle class="dot" cx="142.5" cy="37.5" r="0.5"/>
<line class="wa" x1="142.5" y1="11.5" x2="144.6" y2="11.5"/>
<line class="wa" x1="142.5" y1="24.5" x2="144.6" y2="24.5"/>
<!-- … one arrow per box … -->
```

Bus bar (power or data bus drawn as a narrow bar, label rotated beside it):

```html
<rect class="box" x="42" y="4" width="2" height="39.6"/>
<text class="lbl-s" transform="translate(40.9 23.6) rotate(-90)" text-anchor="middle">AGS BUS</text>
```

## Period symbols

Circuit breaker (two terminals, an arc and a pull handle), with name, rating and function:

```html
<line class="w" x1="22" y1="10.5" x2="28.6" y2="10.5"/>
<circle class="of" cx="29.2" cy="10.5" r="0.6"/><circle class="of" cx="33.8" cy="10.5" r="0.6"/>
<path class="w" d="M29.4,9.6 Q31.5,7.4 33.6,9.6"/>
<line class="w" x1="31.5" y1="8.1" x2="31.5" y2="6.6"/><line class="w" x1="30.4" y1="6.6" x2="32.6" y2="6.6"/>
<line class="w" x1="34.4" y1="10.5" x2="42" y2="10.5"/>
<text class="lbl-s" x="31.5" y="5.4"  text-anchor="middle">CB1</text>
<text class="lbl-s" x="31.5" y="13.2" text-anchor="middle">15A</text>
<text class="lbl-s" x="31.5" y="15.6" text-anchor="middle">AGS MAIN A</text>
```

Three-position selector (common terminal, lever to the selected contact):

```html
<circle class="of" cx="57.6" cy="18.6" r="0.6"/>
<line class="w" x1="58" y1="18.2" x2="64.5" y2="12.8"/>
<circle class="of" cx="65.2" cy="12.4" r="0.6"/>
<circle class="of" cx="65.6" cy="18.6" r="0.6"/>
<circle class="of" cx="65.2" cy="24.8" r="0.6"/>
<text class="lbl-s" x="64.6" y="10.8">A</text>
<text class="lbl-s" x="66.8" y="19.4">OFF</text>
<text class="lbl-s" x="64.6" y="27.8">B</text>
```

Momentary pushbutton (bar over two terminals, plunger above):

```html
<circle class="of" cx="54.6" cy="32" r="0.6"/><circle class="of" cx="59.4" cy="32" r="0.6"/>
<line class="w" x1="53.8" y1="29.8" x2="60.2" y2="29.8"/>
<line class="w" x1="57" y1="29.8" x2="57" y2="27.8"/><line class="w" x1="55.8" y1="27.8" x2="58.2" y2="27.8"/>
<text class="lbl-s" x="57" y="35.2" text-anchor="middle">S2 TRIGGER</text>
```

Talkback indicator, barber pole (striped = in transition, gray = ready):

```html
<circle cx="70" cy="43.6" r="2.2" fill="url(#nh-bp)" stroke="#000" stroke-width="0.35"/>
<text class="lbl-s" x="73.4" y="43.4">AGS RDY TB</text>
<text class="lbl-s" x="73.4" y="45.8">GRAY = READY, BP = CHARGING</text>
```

Hex terminal (only when the text refers to the number):

```html
<g transform="translate(77 12.4)">
  <polygon class="of" points="-1.4,0 -0.7,-1.2 0.7,-1.2 1.4,0 0.7,1.2 -0.7,1.2"/>
  <text class="lbl-s" x="0" y="0.7" text-anchor="middle" style="font-size:1.8px">1</text>
</g>
```

Coil or inductor (four humps):

```html
<path class="w" d="M141,12 a1.4,1.4 0 0 1 2.8,0 a1.4,1.4 0 0 1 2.8,0 a1.4,1.4 0 0 1 2.8,0 a1.4,1.4 0 0 1 2.8,0"/>
```

Capacitor (two object-weight plates 1.6 apart, leads as wires):

```html
<line class="w" x1="12" y1="4" x2="12" y2="11.2"/>
<line class="o" x1="8.6" y1="11.2" x2="15.4" y2="11.2"/>
<line class="o" x1="8.6" y1="12.8" x2="15.4" y2="12.8"/>
<line class="w" x1="12" y1="12.8" x2="12" y2="20"/>
<text class="lbl" x="17" y="11.8">C1</text>
<text class="lbl-s" x="17" y="14.6">470 UF</text>
```

Capacitor bank (narrower plates between two rails) to ground. Ground is three
shortening bars 0.9 apart:

```html
<text class="lbl-s" x="34" y="5.2">28 VDC</text>
<line class="w" x1="34" y1="6" x2="58" y2="6"/>
<circle class="dot" cx="42" cy="6" r="0.55"/><circle class="dot" cx="50" cy="6" r="0.55"/>
<g>  <!-- one per capacitor, at x = 42, 50, 58 -->
  <line class="w" x1="42" y1="6" x2="42" y2="11.2"/>
  <line class="o" x1="39.4" y1="11.2" x2="44.6" y2="11.2"/><line class="o" x1="39.4" y1="12.8" x2="44.6" y2="12.8"/>
  <line class="w" x1="42" y1="12.8" x2="42" y2="18"/>
</g>
<line class="w" x1="42" y1="18" x2="58" y2="18"/>
<circle class="dot" cx="50" cy="18" r="0.55"/>
<line class="w" x1="50" y1="18" x2="50" y2="21"/>
<line class="w" x1="47.8" y1="21" x2="52.2" y2="21"/>       <!-- ground -->
<line class="w" x1="48.7" y1="21.9" x2="51.3" y2="21.9"/>
<line class="w" x1="49.5" y1="22.8" x2="50.5" y2="22.8"/>
<text class="lbl" x="63" y="11.8">C2 BANK (3)</text>
<text class="lbl-s" x="63" y="14.6">3 × 1000 UF</text>
```

Relay contacts, normally open and normally closed (the slash means closed at
rest), and the relay coil with a dashed `.ev` linkage to its contact. Name
contact and coil alike (K1):

```html
<line class="w" x1="76" y1="12" x2="83.2" y2="12"/>
<line class="o" x1="83.2" y1="10.7" x2="83.2" y2="13.3"/>
<line class="o" x1="84.8" y1="10.7" x2="84.8" y2="13.3"/>
<line class="w" x1="84.8" y1="12" x2="92" y2="12"/>
<text class="lbl-s" x="84" y="9.4" text-anchor="middle">K1 NO</text>
<line class="ev" x1="84" y1="13.9" x2="84" y2="26.2"/>             <!-- linkage: 0.6 clear of contact and coil -->
<line class="w" x1="76" y1="28" x2="78.4" y2="28"/>
<path class="w" d="M78.4,28 a1.4,1.4 0 0 1 2.8,0 a1.4,1.4 0 0 1 2.8,0 a1.4,1.4 0 0 1 2.8,0 a1.4,1.4 0 0 1 2.8,0"/>
<line class="w" x1="89.6" y1="28" x2="92" y2="28"/>
<text class="lbl-s" x="84" y="31.4" text-anchor="middle">K1 COIL</text>

<line class="w" x1="96" y1="12" x2="103.2" y2="12"/>                <!-- normally closed -->
<line class="o" x1="103.2" y1="10.7" x2="103.2" y2="13.3"/>
<line class="o" x1="104.8" y1="10.7" x2="104.8" y2="13.3"/>
<line class="w" x1="102.4" y1="13.9" x2="105.6" y2="10.1"/>
<line class="w" x1="104.8" y1="12" x2="112" y2="12"/>
<text class="lbl-s" x="104" y="9" text-anchor="middle">K1 NC</text>
```

Fuse (a box with the wire running through it; draw the wire after the box)
and resistor (six zigzag strokes):

```html
<rect class="of" x="119" y="11.1" width="5.6" height="1.8"/>
<line class="w" x1="115" y1="12" x2="128.6" y2="12"/>
<text class="lbl-s" x="121.8" y="9.8" text-anchor="middle">F1</text>
<text class="lbl-s" x="121.8" y="15.6" text-anchor="middle">5A</text>

<path class="w" d="M132,12 H135 l0.5,-1 l1,2 l1,-2 l1,2 l1,-2 l1,2 l1,-2 l0.5,1 H145"/>
<text class="lbl-s" x="139" y="9.6" text-anchor="middle">R1</text>
<text class="lbl-s" x="139" y="15.6" text-anchor="middle">10 K</text>
```

## Panel front view

For a controls-and-displays figure: the panel as the crew sees it. Grid
letters run along the top and numbers down the left, with short ticks at the
cell boundaries:

```html
<g class="lbl-s" text-anchor="middle">
  <text x="17" y="2.6">A</text><text x="41" y="2.6">B</text><text x="65" y="2.6">C</text><text x="89" y="2.6">D</text><text x="113" y="2.6">E</text>
  <text x="2.4" y="11">1</text><text x="2.4" y="23.7">2</text><text x="2.4" y="36.4">3</text>
</g>
<g class="t">
  <line x1="29" y1="4" x2="29" y2="2.6"/><line x1="53" y1="4" x2="53" y2="2.6"/><line x1="77" y1="4" x2="77" y2="2.6"/><line x1="101" y1="4" x2="101" y2="2.6"/>
  <line x1="5" y1="16.7" x2="3.6" y2="16.7"/><line x1="5" y1="29.3" x2="3.6" y2="29.3"/>
</g>
<rect class="o" x="5" y="4" width="120" height="38"/>
```

Toggle switch from the front (bezel, lever and ball toward the selected
placard), with its name below:

```html
<text class="lbl-s" x="17" y="17.8" text-anchor="middle">ON</text>
<circle class="of" cx="17" cy="23" r="1.5"/>
<line class="o" x1="17" y1="23" x2="17" y2="19.4"/>
<circle class="dot" cx="17" cy="19.4" r="0.5"/>
<text class="lbl-s" x="17" y="27" text-anchor="middle">OFF</text>
<text class="lbl" x="17" y="31" text-anchor="middle">MAIN PWR</text>
```

Rotary selector from the front (detent ticks at −45°, 0° and 45°, pointer at
the selected one):

```html
<g class="t"><line x1="39.02" y1="21.02" x2="38.45" y2="20.45"/><line x1="41" y1="20.2" x2="41" y2="19.4"/><line x1="42.98" y1="21.02" x2="43.55" y2="20.45"/></g>
<circle class="of" cx="41" cy="23" r="2.2"/>
<line class="o" x1="41" y1="23" x2="42.27" y2="21.73"/>
<text class="lbl-s" x="37.6" y="19.6" text-anchor="end">OFF</text>
<text class="lbl-s" x="41" y="18.6" text-anchor="middle">STBY</text>
<text class="lbl-s" x="44.4" y="19.6">ARM</text>
<text class="lbl" x="41" y="31" text-anchor="middle">FLUX MODE</text>
```

Pushbutton or keycap (box with an inset face; 7.2 mm pitch in a keypad, best
generated by a script):

```html
<rect class="box" x="57" y="20" width="5.6" height="4.4"/><rect class="t" x="57.5" y="20.5" width="4.6" height="3.4"/>
<text class="lbl-s" x="59.8" y="22.95" text-anchor="middle">ENT</text>
```

Display window with digits, and an indicator lamp:

```html
<rect class="box" x="79" y="19" width="20" height="6.4"/>
<rect class="t" x="79.7" y="19.7" width="18.6" height="5"/>
<text class="lbl-b" x="89" y="23.1" text-anchor="middle">1.21 GW</text>
<text class="lbl" x="89" y="31" text-anchor="middle">POWER OUT</text>

<circle class="of" cx="113" cy="22.2" r="1.9"/>
<circle class="t" cx="113" cy="22.2" r="1.2"/>
<text class="lbl" x="113" y="28" text-anchor="middle">MASTER</text>
<text class="lbl" x="113" y="30.8" text-anchor="middle">ALARM</text>
```

## Drafting

Callout with leader. The label sits in a row above or below the object; the
leader starts just outside the text and ends on the part:

```html
<text class="lbl" x="84" y="5.2">SINGULARITY CORE</text>
<line class="ld" x1="90" y1="6.2" x2="88.8" y2="27.4"/>        <!-- label above: start 1 below the baseline -->
<text class="lbl" x="58.4" y="59.4">TRIGGER S2</text>
<line class="ld" x1="57.8" y1="58" x2="52.4" y2="45.6"/>        <!-- label below: start left of the text, above its cap line -->
```

Side label with a horizontal leader: end-anchor the text, start the leader
0.8 past it at mid-cap height (baseline − 0.8 for `.lbl`, − 0.7 for `.lbl-s`):

```html
<text class="lbl" x="26" y="38" text-anchor="end">INLET PORT</text>
<line class="ld" x1="26.8" y1="37.2" x2="36" y2="37.2"/>
<text class="lbl-s" x="26" y="41.6" text-anchor="end">DRAIN</text>
<line class="ld" x1="26.8" y1="40.9" x2="36" y2="40.9"/>
```

Horizontal dimension: two extension lines, two half dimension lines with the
arrow at the extension end, and the value in the gap:

```html
<line class="t" x1="17" y1="39.6" x2="17" y2="66.4"/>
<line class="t" x1="130.6" y1="36" x2="130.6" y2="66.4"/>
<line class="dim" x1="17" y1="65.2" x2="63.6" y2="65.2"/>
<line class="dim" x1="130.6" y1="65.2" x2="83.6" y2="65.2"/>
<text class="lbl" x="65.2" y="66">27.60 [701]</text>
```

Vertical dimension (value reads bottom to top):

```html
<line class="t" x1="41" y1="15.4" x2="6.4" y2="15.4"/>
<line class="t" x1="31" y1="62.6" x2="6.4" y2="62.6"/>
<line class="dim" x1="8" y1="15.4" x2="8" y2="34.4"/>
<line class="dim" x1="8" y1="62.6" x2="8" y2="43.8"/>
<text class="lbl" transform="translate(8.9 43.4) rotate(-90)">9.25 [235]</text>
```

Centerline and hidden outline:

```html
<line class="cl" x1="12" y1="30" x2="141" y2="30"/>
<rect class="hid" x="25" y="23.4" width="15" height="8.6"/>
```

Section cut A–A (heavy dash-dot line, arrows show the viewing direction):

```html
<line class="cut" x1="103.9" y1="12.6" x2="103.9" y2="47.4"/>
<polyline class="w" points="103.9,12.6 107.6,12.6"/><path class="dot" d="M107.4,11.6 L109.4,12.6 L107.4,13.6 Z"/>
<polyline class="w" points="103.9,47.4 107.6,47.4"/><path class="dot" d="M107.4,46.4 L109.4,47.4 L107.4,48.4 Z"/>
<text class="lbl-b" x="110.4" y="13.5">A</text>
<text class="lbl-b" x="110.4" y="48.3">A</text>
```

Section view: hatched cut faces, crossing centerlines, title and scale below.
Hatch with the `hatch-cut` / `hatch` classes, never a `fill` attribute next to
`.o` or `.of` (the class wins and the hatch disappears):

```html
<g transform="translate(160 29)">
  <circle r="13.4" class="hatch-cut"/>
  <circle r="10.6" class="of"/>
  <circle r="13.4" class="o"/>
  <line class="cl" x1="-16.4" y1="0" x2="16.4" y2="0"/>
  <line class="cl" x1="0" y1="-16.4" x2="0" y2="16.4"/>
</g>
<text class="lbl-b" x="160" y="49.6" text-anchor="middle">SECTION A–A</text>
<text class="lbl-s" x="160" y="52.4" text-anchor="middle">LOOKING FWD, SCALE 1/2</text>
```

Glass (short parallel diagonal strokes in two corners of the pane):

```html
<g class="t"><line x1="80.6" y1="21.4" x2="83" y2="19.2"/><line x1="81.6" y1="22.4" x2="84.6" y2="19.6"/></g>
```

Coordinate axes (Y out of the page drawn as a dotted circle):

```html
<g transform="translate(150 63.6)">
  <line class="wa" x1="0" y1="0" x2="8.4" y2="0"/>
  <line class="wa" x1="0" y1="0" x2="0" y2="-5.6"/>
  <circle r="0.9" class="of"/><circle r="0.28" class="dot"/>
  <text class="lbl-s" x="9.2" y="0.8">+X</text>
  <text class="lbl-s" x="-1.2" y="-6.4">+Z</text>
  <text class="lbl-s" x="-4.8" y="2.8">+Y</text>
</g>
```

## Time and data

Timeline axis. Pick a scale (here x = 40 + 1.4 × seconds), majors every 10
with labels above, minors every 2. Generate the ticks rather than typing them:

```html
<text class="lbl-s" x="2" y="7.4">MISSION CLOCK, SEC</text>
<line class="w" x1="33" y1="8.2" x2="118" y2="8.2"/>
<g class="t" id="ticks"></g>
<g class="lbl-s" id="tick-labels" text-anchor="middle"></g>
<script>
  // x = x0 + k * t. Ticks every `minor` units, tall ones every `major`, labels every
  // `label` units (a multiple of minor) 2.2 above the axis at y. fmt formats a label.
  function nhTicks({ ticks, labels, x0, k, from, to, minor = 2, major = 10, label = major, y = 8.2, fmt = t => t }) {
    const ns = 'http://www.w3.org/2000/svg', T = document.getElementById(ticks), L = document.getElementById(labels)
    const on = (t, step) => Math.abs(t / step - Math.round(t / step)) < 1e-6
    for (let i = 0; i <= Math.round((to - from) / minor); i++) {
      const t = +(from + i * minor).toFixed(6), x = +(x0 + k * t).toFixed(3), l = document.createElementNS(ns, 'line')
      l.setAttribute('x1', x); l.setAttribute('x2', x); l.setAttribute('y1', y); l.setAttribute('y2', on(t, major) ? y - 1.4 : y - 0.6); T.append(l)
      if (on(t, label)) { const s = document.createElementNS(ns, 'text'); s.setAttribute('x', x); s.setAttribute('y', y - 2.2); s.textContent = fmt(t); L.append(s) }
    }
  }
  nhTicks({ ticks: 'ticks', labels: 'tick-labels', x0: 40, k: 1.4, from: -2, to: 54 })
</script>
```

Broken axis, for a long idle span (here 0–10 h, then 34–44 h). End the axis,
draw two parallel `//` strokes 2.4 apart, and resume. After the break,
`x0 = (x where the axis resumes) − k × (t where it resumes)`. A bar that
crosses the break is two open paths (no end at the break) with the same
strokes through it:

```html
<line class="w" x1="38" y1="22.2" x2="81" y2="22.2"/>
<line class="t" x1="81.8" y1="23" x2="83" y2="21.4"/><line class="t" x1="84.2" y1="23" x2="85.4" y2="21.4"/>
<line class="w" x1="86.2" y1="22.2" x2="130" y2="22.2"/>
<g class="t" id="bt"></g>
<g class="lbl-s" id="btl" text-anchor="middle"></g>
<path class="aud" d="M81,25.6 L60,25.6 L60,28.2 L81,28.2"/>
<path class="aud" d="M86.2,25.6 L100,25.6 L100,28.2 L86.2,28.2"/>
<line class="t" x1="81.8" y1="28.7" x2="83" y2="25.1"/><line class="t" x1="84.2" y1="28.7" x2="85.4" y2="25.1"/>
<script>
  nhTicks({ ticks: 'bt', labels: 'btl', x0: 40, k: 4, from: 0, to: 10, minor: 1, major: 5, y: 22.2, fmt: t => t + ' H' })
  nhTicks({ ticks: 'bt', labels: 'btl', x0: 88 - 4 * 34, k: 4, from: 34, to: 44, minor: 1, major: 5, y: 22.2, fmt: t => t + ' H' })
</script>
```

Lanes: label column at x 2–30, bars 2.6 mm tall, lanes 4.4 mm apart. A break
in a bar is a new file or segment; `.gap` is a pending or absent span:

```html
<text class="lbl-s" x="2" y="21">STATION 2 · CAMERA</text>
<rect class="vid" x="40"   y="19.1" width="29.4" height="2.6"/>
<rect class="vid" x="70.2" y="19.1" width="37"   height="2.6"/>
<rect class="aud" x="40"   y="23.5" width="33.6" height="2.6"/>
<rect class="gap" x="73.6" y="23.5" width="9.8"  height="2.6"/>
```

Event (dashed vertical through all lanes, label on top) and marker triangle:

```html
<line class="ev" x1="107.2" y1="1.6" x2="107.2" y2="37.6"/>
<text class="lbl-s" x="107.2" y="1.2" text-anchor="middle">STOP</text>
<path class="dot" d="M58.9,7.4 L60.3,7.4 L59.6,8.6 Z"/>
<text class="lbl-s" x="59.6" y="6" text-anchor="middle">M</text>
```

Staggered event labels, for events closer than about 8 mm: alternate two
label rows 2.8 apart, and start each line 0.4 below its own label. A
lower-row label must clear the neighbouring lines by 0.6, so keep it short
(4 mm events allow about six characters); otherwise put the labels below the
lanes:

```html
<text class="lbl-s" x="140" y="33.4" text-anchor="middle">MIX</text>
<text class="lbl-s" x="148" y="33.4" text-anchor="middle">LOAD</text>
<text class="lbl-s" x="144" y="36.2" text-anchor="middle">FOLD</text>
<text class="lbl-s" x="152" y="36.2" text-anchor="middle">DONE</text>
<line class="ev" x1="140" y1="33.8" x2="140" y2="47"/>
<line class="ev" x1="148" y1="33.8" x2="148" y2="47"/>
<line class="ev" x1="144" y1="36.6" x2="144" y2="47"/>
<line class="ev" x1="152" y1="36.6" x2="152" y2="47"/>
```

Legend (bottom left, a swatch and a name per row):

```html
<rect class="vid" x="2" y="38.6" width="5" height="2.4"/><text class="lbl-s" x="8.2" y="40.6">VIDEO STREAM</text>
<rect class="aud" x="2" y="42.4" width="5" height="2.4"/><text class="lbl-s" x="8.2" y="44.4">AUDIO STREAM</text>
```

Sequence detail (two lifelines, a request and a reply):

```html
<text class="lbl-s" x="133" y="6.4" text-anchor="middle">STATION</text>
<text class="lbl-s" x="169" y="6.4" text-anchor="middle">ROUTER</text>
<line class="w" x1="133" y1="7.4" x2="133" y2="23.4"/>
<line class="w" x1="169" y1="7.4" x2="169" y2="23.4"/>
<line class="wa" x1="133" y1="10" x2="168.6" y2="14.6"/>
<line class="wa" x1="169" y1="14.8" x2="133.4" y2="20.2"/>
<text class="lbl-s" x="151" y="11.2" text-anchor="middle">PING</text>
<text class="lbl-s" x="151" y="19.8" text-anchor="middle">PONG</text>
<text class="lbl-s" x="151" y="27" text-anchor="middle">OFFSET = SERVER − (T0 + T1) / 2</text>
```

On a steeper arrow, rotate the label to the slope: centre it on the arrow and
offset it 0.8 along the upward normal. For an arrow from (x1, y1) to
(x2, y2), a = atan2(y2 − y1, x2 − x1); the label sits at the midpoint plus
(0.8 sin a, −0.8 cos a), rotated by a in degrees. Or keep it horizontal, clear
of the line by 0.8 along its whole length:

```html
<line class="wa" x1="60" y1="37" x2="109.6" y2="44"/>
<text class="lbl-s" text-anchor="middle" transform="translate(84.91 39.71) rotate(8.03)">CLIENTHELLO</text>
<line class="wa" x1="110" y1="48" x2="60.4" y2="54"/>
<text class="lbl-s" x="106" y="46.8" text-anchor="end">SERVERHELLO</text>
```

Parts strip (a file cut into fixed parts; hatched = special, dotted = filling):

```html
<rect class="vid" x="126" y="36.6" width="8" height="3.6"/>
<rect class="aud" x="134" y="36.6" width="8" height="3.6"/>
<rect class="gap" x="158" y="36.6" width="8" height="3.6"/>
<rect x="129.2" y="37.3" width="1.6" height="2.2" style="fill: var(--paper)"/>  <!-- clears the hatch behind a digit -->
<text class="lbl-s" x="130" y="39.2" text-anchor="middle">1</text>
```

## Fluid and instruments

Flow lines are `.w` / `.wa` wires; arrows show flow direction. These parts sit
on a line and break it.

Check valve (flow left to right; the bar is the seat):

```html
<line class="w" x1="19" y1="23" x2="23.4" y2="23"/>
<path class="of" d="M23.4,21.6 L23.4,24.4 L25.8,23 Z"/>
<line class="w" x1="26" y1="21.6" x2="26" y2="24.4"/>
<text class="lbl-s" x="24.7" y="20.6" text-anchor="middle">V1</text>
```

Two-way valve with actuator (bow tie, stem, actuator box):

```html
<path class="of" d="M18.8,35.6 L18.8,38.4 L21,37 Z"/>
<path class="of" d="M23.2,35.6 L23.2,38.4 L21,37 Z"/>
<line class="w" x1="21" y1="37" x2="21" y2="33.6"/>
<rect class="box" x="19.2" y="31.2" width="3.6" height="2.4"/>
<text class="lbl-s" x="21" y="30" text-anchor="middle">BPV-2</text>
```

Pump (circle with a filled triangle pointing downstream):

```html
<circle class="of" cx="63" cy="23" r="2.6"/>
<path class="dot" d="M61.8,21.6 L64.8,23 L61.8,24.4 Z"/>
<text class="lbl-s" x="63" y="28.2" text-anchor="middle">P1 PUMP</text>
```

Heat exchanger (a box with the two passes drawn as opposed thin arrows):

```html
<rect class="box" x="34" y="19" width="22" height="22"/>
<line class="ld" x1="35" y1="23" x2="55" y2="23"/>
<line class="ld" x1="55" y1="37" x2="35" y2="37"/>
<text class="lbl-b" x="45" y="28.6" text-anchor="middle">HX1</text>
<text class="lbl" x="45" y="31.4" text-anchor="middle">EXTRACT COOLER</text>
```

Finned radiator (header tanks top and bottom, fins every 1.2 mm, air arrows
into the core):

```html
<rect class="box" x="62" y="4" width="20" height="12"/>
<g class="t"><line x1="62" y1="5.4" x2="82" y2="5.4"/><line x1="62" y1="14.6" x2="82" y2="14.6"/></g>
<g class="t" id="fins"></g>
<line class="wa" x1="56" y1="7" x2="61.6" y2="7"/>
<line class="wa" x1="62" y1="13" x2="56.4" y2="13"/>
<g class="ld"><line x1="66" y1="21" x2="66" y2="16.4"/><line x1="72" y1="21" x2="72" y2="16.4"/><line x1="78" y1="21" x2="78" y2="16.4"/></g>
<text class="lbl-s" x="64.6" y="21.4" text-anchor="end">AIR</text>
<text class="lbl-b" x="84.4" y="9">HX2</text>
<text class="lbl" x="84.4" y="11.8">RADIATOR</text>
<script>
  for (let x = 63.2; x < 81.5; x += 1.2) document.getElementById('fins').insertAdjacentHTML('beforeend', `<line x1="${x.toFixed(1)}" y1="5.4" x2="${x.toFixed(1)}" y2="14.6"/>`)
</script>
```

Blower or fan (pump-sized circle with three blades and a hub):

```html
<line class="wa" x1="100" y1="10" x2="105.8" y2="10"/>
<g transform="translate(108.4 10)">
  <circle class="of" r="2.6"/>
  <g class="dot"><ellipse cy="-1.15" rx="0.42" ry="1"/><ellipse cy="-1.15" rx="0.42" ry="1" transform="rotate(120)"/><ellipse cy="-1.15" rx="0.42" ry="1" transform="rotate(240)"/></g>
  <circle class="of" r="0.45"/>
</g>
<text class="lbl-s" x="108.4" y="15.6" text-anchor="middle">B1 BLOWER</text>
<line class="wa" x1="111" y1="10" x2="129.6" y2="10"/>
```

Membrane or separator (a box split by a fine dotted wall, sides named):

```html
<rect class="box" x="130" y="4" width="30" height="12"/>
<line style="fill:none; stroke:var(--ink); stroke-width:0.4; stroke-dasharray:0.7 0.45" x1="145" y1="4" x2="145" y2="16"/>
<text class="lbl-s" x="137.5" y="10.7" text-anchor="middle">FEED</text>
<text class="lbl-s" x="152.5" y="10.7" text-anchor="middle">PERMEATE</text>
<text class="lbl" x="145" y="19.6" text-anchor="middle">M1 MEMBRANE</text>
```

Flexible hose or cable: one 1.6 mm object stroke with a 0.9 mm paper stroke
on the same path leaves two parallel walls. End fittings go on top:

```html
<path class="o" style="stroke-width:1.6; stroke-linecap:butt" d="M12,8 C22,8 24,16 34,16 S44,12 50,12"/>
<path style="fill:none; stroke:var(--paper); stroke-width:0.9" d="M12,8 C22,8 24,16 34,16 S44,12 50,12"/>
<rect class="of" x="9.6" y="6.6" width="2.4" height="2.8"/>
<rect class="of" x="50" y="10.6" width="2.4" height="2.8"/>
<text class="lbl" x="22" y="21.6">FLEX HOSE</text>
<line class="ld" x1="27" y1="19" x2="28.6" y2="14.6"/>
```

Gauge on a tee (junction dot, stem, dial with a needle):

```html
<circle class="dot" cx="95.4" cy="13" r="0.5"/>
<line class="w" x1="95.4" y1="13" x2="95.4" y2="17.4"/>
<circle class="of" cx="95.4" cy="19" r="1.6"/>
<line class="w" x1="95.4" y1="19" x2="96.4" y2="17.9"/>
<text class="lbl-s" x="95.1" y="23" text-anchor="middle">BREW PRESS</text>
```

Sensor (tagged circle on a stem; a dashed `.ev` line carries its signal to
what it controls). Make the circle big enough for its tag: r 1.7 for two
characters at 1.8 px:

```html
<line class="w" x1="27.8" y1="37" x2="27.8" y2="33.9"/>
<circle class="of" cx="27.8" cy="32.2" r="1.7"/>
<text class="lbl-s" x="27.8" y="32.85" text-anchor="middle" style="font-size:1.8px">T2</text>
<line class="ev" x1="26.1" y1="32.2" x2="22.8" y2="32.2"/>
```

Station tags (numbered circles on the lines) and a station data list keyed to
them. Use them when the text or a chart refers to points in the flow:

```html
<g transform="translate(58.2 23)"><circle class="of" r="1.3"/><text class="lbl-s" y="0.65" text-anchor="middle" style="font-size:1.8px">2</text></g>

<text class="lbl-s" x="35" y="43.6">STATION DATA:</text>
<text class="lbl-s" x="35" y="46">PRESSURE ABS, TEMP</text>
<g transform="translate(59.4 40.9)"><circle class="of" r="1.3"/><text class="lbl-s" y="0.65" text-anchor="middle" style="font-size:1.8px">1</text><text class="lbl-s" x="2" y="0.75">2.4 BAR, 22 °C</text></g>
```

Granular or packed material (grounds, powder, pellets, a filter bed): the
`.grain` class fills with the `nh-dots` stipple. Clear the dots behind a label
with a paper rectangle, as the parts strip does for its digits:

```html
<rect class="grain" x="102" y="15.4" width="16" height="3.2"/>
```

## Charts

A chart is a DETAIL inset or a whole secondary figure: L-shaped axes, short
ticks (1.2 major, 0.8 minor), tick labels in `.lbl-s`, axis titles with
units, the y title rotated. Compute the curve's points in a script and paste
them as one polyline, two decimals each. Reference levels and limits are
dashed `.ev` lines labelled on the line.

```html
<!-- x: 40..100 kPa over 139..176; y: 70..100 °C over 33..3 -->
<polyline class="w" points="139,3 139,33 176,33"/>
<g class="t">
  <line x1="139" y1="33" x2="139" y2="34.2"/><line x1="149.57" y1="33" x2="149.57" y2="34.2"/>
  <line x1="139" y1="23" x2="137.8" y2="23"/><line x1="139" y1="13" x2="137.8" y2="13"/>
</g>
<g class="lbl-s" text-anchor="middle"><text x="139" y="36.4">40</text><text x="149.57" y="36.4">60</text></g>
<g class="lbl-s" text-anchor="end"><text x="137.4" y="23.7">80</text><text x="137.4" y="13.7">90</text></g>
<text class="lbl-s" x="157.5" y="39.4" text-anchor="middle">PRESSURE, KPA ABS</text>
<text class="lbl-s" transform="translate(131.4 18) rotate(-90)" text-anchor="middle">TEMPERATURE, °C</text>
<polyline class="w" points="139.00,27.06 144.29,21.61 149.57,17.01 154.86,13.01 160.14,9.47 165.43,6.28 170.71,3.37"/>
<line class="ev" x1="139" y1="23" x2="171.41" y2="23"/>
<text class="lbl-s" x="156" y="22.2" text-anchor="middle">T2 LIMIT 80 °C</text>
<circle class="dot" cx="147.72" cy="18.54" r="0.5"/>                       <!-- a marked point -->
<g class="w"><line x1="146.82" y1="9.1" x2="148.62" y2="10.9"/><line x1="146.82" y1="10.9" x2="148.62" y2="9.1"/></g>  <!-- an X: a state to avoid -->
<line class="wa" x1="171.41" y1="16.4" x2="171.41" y2="25.4"/>             <!-- process path between stations -->
```
