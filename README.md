# SOF Logger VS Code Extension

A robust, high-performance Visual Studio Code extension built for visualizing executing Sound Open Firmware (SOF) QEMU logs and inspecting telemetry traces natively inside the Integrated Development Environment.

The SOF Logger translates raw `qemu-exec-default.log` CCOUNT/wall-clock text logs into precise, sub-millisecond Interactive call-stack visualizers and timeline graphs. Hardware Exceptions, Memory bounds, and Thread executions are tracked intuitively natively alongside your C source-code.

## Features

- **Double-Click Source Navigation:** Double-click on any Call Stack traces or Chart boundaries to jump straight into the related `.c` code precisely centered on the generated instruction natively inside your editor window.
- **Chart.js Timeline Telemetry:** Tracks exact metric bounds across:
  - Total `CCOUNT` Execution Deltas
  - Absolute Call Stack instruction depth levels
  - Hardware Execution Rings / Supervisor State Flags
  - CPU Interrupt triggers natively (Levels 0-16)
  - Instruction / Data Cache (TLB) misses
- **Context Search Sidebar:** Sequentially list every Function Call over execution traces natively with search/filter mechanics dynamically snapping and zooming visual metrics exactly over requested ranges.
- **Background ELF Resolution:** The extension resolves ELF memory bindings cleanly and efficiently via `nm -nS -l zephyr.elf` over background worker queues without interrupting UI responsibilities, generating readable C function parameters implicitly mapping execution.

## Dependencies

- **VS Code ^1.80.0**: Extension Host engine
- **Node.js**: (Version >= 16x) natively mapped for build resolution.
- **GNU Binutils (`nm`)**: Crucial requirement. The system must possess native mapping bounds for `nm` (`x86_64-linux-gnu-nm`, `xtensa-lx106-elf-nm`, etc). This strictly facilitates source file translation mappings directly off the ELF object structures dynamically! Ensure this executes on your system.

## Setup & Build

1. Clone or copy the repository contents: `vscode ~/sof-logger/`
2. Install the necessary development dependencies using npm:
   ```sh
   npm install
   ```
3. Compile the typescript engine statically into your node package layout safely:
   ```sh
   npm run compile
   ```
4. Press `F5` to securely open the VS Code Extension Development Host in evaluation mode and test it out.

## Usage

1. Collect execution logs from QEMU by running the simulation with explicit tracing flags. Use the following generic command structure (replace paths with your local repository locations):
   ```sh
   <path/to/qemu>/build/qemu-system-xtensa -machine adsp_ace30 -kernel <path/to/sof>/build-ptl/zephyr/zephyr.ri -display none -serial mon:stdio -icount shift=5,align=off -smp 5 -d func,int,mmu -D /tmp/qemu-exec-default.log
   ```
2. Verify `/tmp/qemu-exec-default.log` generated successfully and natively hosts string representations of `T: 00... FUNC ENTRY/RET` trace flags.
3. Inside Visual Studio Code, press **`Ctrl+Shift+P`** to open the Command Palette safely.
4. Type and execute: **`SOF Logger: Visualize QEMU Log`**.
5. The Visualization Webview will immediately lock rendering boundaries over the graph structures natively while asynchronously retrieving and syncing all underlying address components cleanly.
6. To load full file context paths to navigate through C-files directly, click the **`Load ELF Symbols`** toolbar button natively and point it correctly towards your primary `zephyr.elf` compiled source target.

### Chart Mechanics
- **Scroll Wheel**: Smooth, high-performance decimation bounding box zoom!
- **Click & Drag**: Generates an isolated translucent blue bounding box isolating precise microsecond executions snapping directly off execution boundaries.
- **Ctrl + Drag**: Forces a parallel perspective, physically sliding the timeline across milliseconds dynamically without scaling contexts.
