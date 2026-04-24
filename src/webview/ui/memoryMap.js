        function renderMemoryMap() {
          const layoutContainer = document.getElementById('memoryMapLayout');
          if (!layoutContainer) return;

          let oldContainer = document.getElementById('memory-map-container');
          window.__memMapState = window.__memMapState || {
              mapZoom: 1.0,
              baseZoom: 1.0,
              scrollOffsets: {},
              scrollTopStart: 0,
              visualPanX: 0,
              visualPanY: 0
          };

          if (oldContainer) {
              if (!window.__memMapState.scrollOffsets) window.__memMapState.scrollOffsets = {};
              oldContainer.querySelectorAll('.map-scrollable').forEach(s => {
                  window.__memMapState.scrollOffsets[s.id] = s.scrollLeft;
              });
              window.__memMapState.scrollTopStart = layoutContainer.scrollTop;
          }

          const container = document.createElement('div');
          container.id = 'memory-map-container-backbuffer';
          container.style.height = '100%';
          container.style.width = '100%';
          container.style.flexGrow = '1';
          container.style.overflowY = 'auto';
          container.style.overflowX = 'hidden';
          container.style.position = 'relative';

          let isDragging = false;
          let startX = 0;
          let startY = 0;
          let dxGlobal = 0;
          let scrollLeftStarts = [];
          
          let pendingZoomAnchor = null;
          let redrawTimeout = null;

          function updateEdgeLabels() {
              const scrolls = container.querySelectorAll('.map-scrollable');
              scrolls.forEach(s => {
                  const bRect = s.getBoundingClientRect();
                  s.querySelectorAll('.bank-row').forEach(row => {
                      const endL = row.querySelector('.end-label');
                      if (endL) {
                          const w = row.getBoundingClientRect().width;
                          const vw = bRect.width;
                          const sl = s.scrollLeft;
                          endL.style.left = Math.min(w - 60, Math.max(100, sl + vw - 60)) + 'px';
                      }
                      const stL = row.querySelector('.start-label');
                      if (stL) {
                          const sl = s.scrollLeft;
                          stL.style.left = Math.max(2, sl + 2) + 'px';
                      }
                  });
              });
          }

          function commitRedraw() {
              window.__memMapState.baseZoom = window.__memMapState.mapZoom;
              window.__memMapState.visualPanX = 0;
              window.__memMapState.visualPanY = 0;
              
              container.querySelectorAll('.map-scrollable').forEach(scrollable => {
                 const inner = scrollable.querySelector('.map-inner');
                 if (inner) {
                     inner.style.transform = '';
                     // @ts-ignore
                     inner.style.width = (window.__memMapState.mapZoom * 100) + '%';
                 }
              });
              
              container.querySelectorAll('.addr-marker').forEach(marker => {
                 // @ts-ignore
                 marker.style.display = (window.__memMapState.mapZoom >= parseFloat(marker.dataset.z)) ? 'block' : 'none';
              });
              
              if (pendingZoomAnchor) {
                  const scrolls = container.querySelectorAll('.map-scrollable');
                  if (scrolls.length > 0) {
                      const newWidth = scrolls[0].scrollWidth;
                      const newLeft = (newWidth * pendingZoomAnchor.ratio) - pendingZoomAnchor.pX;
                      scrolls.forEach(s => { s.scrollLeft = newLeft; });
                  }
                  pendingZoomAnchor = null;
              } else if (scrollLeftStarts.length > 0) {
                 const newLeft = scrollLeftStarts[0].startLeft - dxGlobal;
                 scrollLeftStarts.forEach(obj => { obj.el.scrollLeft = newLeft; });
              }
              
              updateEdgeLabels();
          }

          container.addEventListener('wheel', (e) => {
              e.preventDefault();
              let delta = e.deltaY > 0 ? -0.1 : 0.1;
              if (window.__memMapState.mapZoom >= 2.0) delta = e.deltaY > 0 ? -0.5 : 0.5;
              if (window.__memMapState.mapZoom >= 5.0) delta = e.deltaY > 0 ? -1.0 : 1.0;
              if (window.__memMapState.mapZoom >= 15.0) delta = e.deltaY > 0 ? -5.0 : 5.0;
              if (window.__memMapState.mapZoom >= 50.0) delta = e.deltaY > 0 ? -10.0 : 10.0;
              if (window.__memMapState.mapZoom >= 100.0) delta = e.deltaY > 0 ? -25.0 : 25.0;
              if (window.__memMapState.mapZoom >= 300.0) delta = e.deltaY > 0 ? -50.0 : 50.0;
              
              window.__memMapState.mapZoom = Math.max(0.1, Math.min(2000.0, window.__memMapState.mapZoom + delta));
              
              const scale = window.__memMapState.mapZoom / window.__memMapState.baseZoom;
              
              if (!pendingZoomAnchor) {
                  const scrolls = container.querySelectorAll('.map-scrollable');
                  if (scrolls.length > 0) {
                      const rect = scrolls[0].getBoundingClientRect();
                      const pX = e.clientX - rect.left;
                      const absX = scrolls[0].scrollLeft + pX;
                      pendingZoomAnchor = { ratio: absX / scrolls[0].scrollWidth, pX: pX, absX: absX };
                  }
              }

              if (pendingZoomAnchor) {
                  container.querySelectorAll('.map-inner').forEach(inner => {
                      // @ts-ignore
                      inner.style.transformOrigin = pendingZoomAnchor.absX + 'px center';
                      // @ts-ignore
                      inner.style.transform = 'scaleX(' + scale + ')';
                  });
              }
              
              clearTimeout(redrawTimeout);
              redrawTimeout = setTimeout(() => { commitRedraw(); }, 200);
          }, { passive: false });
          
          container.addEventListener('mousedown', (e) => {
             isDragging = true;
             startX = e.pageX;
             startY = e.pageY;
             dxGlobal = 0;
             scrollLeftStarts = Array.from(container.querySelectorAll('.map-scrollable')).map(s => ({
                el: s,
                startLeft: s.scrollLeft
             }));
             if (layoutContainer) window.__memMapState.scrollTopStart = layoutContainer.scrollTop;
             container.style.cursor = 'grabbing';
             clearTimeout(redrawTimeout);
          });

          window.addEventListener('mousemove', (e) => {
             if (!isDragging) return;
             e.preventDefault();
             dxGlobal = e.pageX - startX;
             const dy = e.pageY - startY;
             container.querySelectorAll('.map-inner').forEach(inner => {
                 // scaleX applies visual modifications without recomputing layouts!
                 // @ts-ignore
                 inner.style.transform = 'translateX(' + dxGlobal + 'px)';
             });
             
             if (layoutContainer) layoutContainer.scrollTop = window.__memMapState.scrollTopStart - dy;
          });

          window.addEventListener('mouseup', () => {
             if (isDragging) {
                isDragging = false;
                container.style.cursor = 'auto';
                clearTimeout(redrawTimeout);
                commitRedraw();
             }
          });
          
          let scrollDebounce = null;
          container.addEventListener('scroll', () => { 
             clearTimeout(scrollDebounce);
             scrollDebounce = setTimeout(() => { updateEdgeLabels(); }, 100);
          }, true);
          
          if (!symbolsData || symbolsData.length === 0) {
            container.innerHTML = '<p><i>Please use the "Load ELF Symbols" button successfully before tracing Hardware Memory allocations!</i></p>';
            if (oldContainer) oldContainer.remove();
            container.id = 'memory-map-container';
            layoutContainer.appendChild(container);
            return;
          }

          // --- EXTRACT DYNAMIC ALLOCATIONS FROM LOG DATA ---
          const coreStacks = {};
          const heapAllocs = [];

          function guessAllocSize(name, args) {
             if (!args) return 0;
             const n = name.toLowerCase();
             const a = args.map(x => parseInt(x, 16) || 0);

             // Evaluate exact argument indices based cleanly on alloc.c prototypes
             if (n.includes('virtual_heap_alloc')) return a[2]; // (heap, flags, bytes, align)
             if (n.includes('sof_heap_alloc')) return a[2]; // (heap, flags, bytes, align)
             if (n.includes('l3_heap_alloc')) return a[2]; // (heap, align, bytes)
             if (n.includes('heap_alloc_aligned')) return a[2]; // (heap, align, bytes)
             
             if (n.includes('rmalloc_align')) return a[1]; // (flags, bytes, alignment)
             if (n.includes('rmalloc')) return a[1]; // (flags, bytes)
             if (n.includes('rballoc_align')) return a[1]; // (flags, bytes, align)
             if (n.includes('rballoc')) return a[1]; // (flags, caps, bytes) occasionally
             
             if (n.includes('rzalloc')) return a[1]; // (flags, bytes)
             if (n.includes('rbrealloc') || n.includes('realloc')) return a[2]; // (ptr, flags, bytes, ...)
             if (n.includes('vmh_alloc')) return a[1]; // (heap, alloc_size)
             if (n.includes('vmh_alloc')) return a[1]; // (heap, alloc_size)
             
             if (n.includes('sys_heap_aligned_alloc')) return a[2]; // (heap, align, bytes)
             if (n.includes('sys_heap_alloc') || n.includes('z_malloc_heap')) return a[1]; // (heap, bytes)
             
             // Fallback iteration
             return a[2] || a[1] || a[0];
          }

           function guessAllocFlags(name, args) {
              if (!args) return '0x0';
              const n = name.toLowerCase();
              if (n.includes('virtual_heap_alloc')) return args[1];
              if (n.includes('sof_heap_alloc')) return args[1];
              if (n.includes('rbrealloc') || n.includes('realloc')) return args[1];
              if (n.includes('sys_heap_') || n.includes('z_malloc_')) return 'N/A';
              if (n.includes('l3_heap_alloc') || n.includes('heap_alloc_aligned')) return 'N/A';
              if (n.includes('vmh_alloc')) return 'N/A';
              return args[0]; // For rmalloc, rzalloc, rballoc
           }
          const pageAttributes = {};
          const tlbRanges = [];
          let lastTlbAttrObj = null;
          let lastTlbPaddr = null;
          logData.forEach((d) => {
             if (d.tlbDetails) {
                 let vaddrMtch = d.tlbDetails.match(/vaddr=(0x[0-9a-f]+)/i);
                 let paddrMtch = d.tlbDetails.match(/paddr=(0x[0-9a-f]+)/i);
                 let asidMtch = d.tlbDetails.match(/asid=(0x[0-9a-f]+)/i);
                 let attrMtch = d.tlbDetails.match(/attr=(0x[0-9a-f]+)/i);
                 let ringMtch = d.tlbDetails.match(/ring=(\d)/i);
                 
                 if (paddrMtch) {
                     lastTlbPaddr = parseInt(paddrMtch[1], 16);
                     const base4k = lastTlbPaddr - (lastTlbPaddr % 4096);
                     const prior = pageAttributes[base4k] || { ring: '0', asid: '0x0', attr: '0x0', vaddr: 0 };
                     
                     lastTlbAttrObj = { 
                        asid: asidMtch ? asidMtch[1] : prior.asid, 
                        attr: attrMtch ? attrMtch[1] : prior.attr, 
                        ring: ringMtch ? ringMtch[1] : prior.ring,
                        vaddr: (vaddrMtch && paddrMtch) ? (parseInt(vaddrMtch[1], 16) - parseInt(paddrMtch[1], 16)) : prior.vaddr
                     };
                     
                     pageAttributes[base4k] = lastTlbAttrObj;
                 }
                 
                 const pgSizeMtch = d.tlbDetails.match(/page_size=(0x[0-9a-f]+)/i);
                 if (pgSizeMtch && lastTlbAttrObj && lastTlbPaddr !== null) {
                     const pageSize = parseInt(pgSizeMtch[1], 16);
                     const baseBase = lastTlbPaddr - (lastTlbPaddr % 4096);
                     
                     tlbRanges.push({ start: baseBase, end: baseBase + pageSize, attr: lastTlbAttrObj });
                     lastTlbAttrObj = null;
                     lastTlbPaddr = null;
                 }
             }
             
             const core = d.core !== undefined ? d.core : 0;
             if (!coreStacks[core]) coreStacks[core] = [];
             
             if (d.funcArgs) {
                // Entry Trace
                const deepStack = coreStacks[core].map(s => s.name);
                coreStacks[core].push({ 
                    name: d.funcName, 
                    args: d.funcArgs, 
                    isEntry: isAllocCall(d.funcName),
                    stackChain: deepStack,
                    sp: d.funcSp
                });
             } else if (d.funcRet && d.funcSp) {
                // Exit Trace
                // Function RET PCs don't natively match symbols (they are retw instructions).
                // Safely grab the corresponding stack frame structurally resolving SP alignments instead!
                if (coreStacks[core].length > 0) {
                   let matchIdx = -1;
                   for (let i = coreStacks[core].length - 1; i >= 0; i--) {
                       if (coreStacks[core][i].sp === d.funcSp) {
                           matchIdx = i;
                           break;
                       }
                   }
                   
                   if (matchIdx !== -1) {
                       const entryNode = coreStacks[core][matchIdx];
                       // Structurally pop this frame and everything above it implicitly aligning dropping corrupted bounds
                       coreStacks[core] = coreStacks[core].slice(0, matchIdx);
                       
                       const name = entryNode.name;
                       // Track dynamic allocations exactly closing execution boundaries structurally resolving parameters!
                       if (entryNode.isEntry && isAllocCall(name)) {
                           const size = guessAllocSize(name, entryNode.args);
                           const flags = guessAllocFlags(name, entryNode.args);
                            const ptr = parseInt(d.funcRet, 16);
                           if (size > 0 && ptr > 0) {
                              const callerName = entryNode.stackChain && entryNode.stackChain.length > 0 ? entryNode.stackChain[entryNode.stackChain.length - 1] : name;
                              heapAllocs.push({
                                  name: name,
                                  stackChain: entryNode.stackChain,
                                  addr: ptr,
                                  size: size,
                                  flags: flags,
                                  args: entryNode.args,
                                  sect: 'heap_dyn',
                                  file: symbolsData.find(s => s.name === callerName)?.file || symbolsData.find(s => s.name === name)?.file || '',
                                  line: symbolsData.find(s => s.name === callerName)?.line || symbolsData.find(s => s.name === name)?.line || 0
                              });
                           }
                       }
                   }
                }
             }
          });

          // We evaluate allocation components sequentially to correctly fold wrapper pointers (like rzalloc) possessing shifted address offsets safely into their exact originating vmh_alloc footprint seamlessly!
          const finalHeapAllocs = [];
          heapAllocs.forEach(alloc => {
              // Ignore any child beneath the fundamental physical boundary
              if (alloc.stackChain.includes('vmh_alloc') && alloc.name !== 'vmh_alloc') return;
              
              if (!alloc.visualName) {
                  alloc.visualName = alloc.name;
                  alloc.visualStack = alloc.stackChain || [];
              }
              
              // Scan backwards to find if this is just a wrapper finishing over its explicit internal payload.
              let replaced = false;
              for (let i = finalHeapAllocs.length - 1; i >= Math.max(0, finalHeapAllocs.length - 15); i--) {
                  const prev = finalHeapAllocs[i];
                  if (prev.stackChain && prev.stackChain.includes(alloc.name)) {
                      // It belongs to the same execution trace! The child (prev) contains the parent (alloc) natively.
                      // We overwrite the child's visual representation globally with the parent's parameters natively, 
                      // stripping the inner API from the TreeView dynamically!
                      prev.visualName = alloc.name;
                      prev.visualStack = alloc.stackChain || [alloc.name];
                      prev.args = alloc.args; // Update explicit arg strings explicitly for Sidebar
                      prev.file = alloc.file;
                      prev.line = alloc.line;
                      replaced = true;
                      break;
                  }
              }
              
              if (!replaced) {
                  finalHeapAllocs.push(alloc);
              }
          });

          // Append uniquely compiled dynamic structures targeting ELF Map arrays seamlessly
          finalHeapAllocs.forEach(alloc => {
             symbolsData.push(alloc);
          });
          
          // Populate allocation sidebar natively mimicking structural elements securely!

          // ----------------------------------------------------

          let regions = {};
          if (regionsMeta && regionsMeta.length > 0) {
             regionsMeta.forEach(r => { regions[r.name] = []; });
          } else {
             regions = { 'IMR': [], 'LPSRAM': [], 'HPSRAM': [] };
          }
          
          symbolsData.forEach(sym => {
            if (sym.size > 0) {
              let rName = '';
              if (regionsMeta && regionsMeta.length > 0) {
                 const matched = regionsMeta.find(r => sym.addr >= r.start && sym.addr < r.end);
                 if (matched) rName = matched.name;
                 else {
                   const prefix = sym.addr >>> 20;
                   if (prefix === 0xA00) rName = 'hp-sram (deferred)';
                   else if (prefix === 0xA01 || prefix === 0xA10) rName = 'lp-sram (overflow)';
                 }
              } else {
                 const prefix = sym.addr >>> 20; 
                 if (prefix === 0xA00) rName = 'HPSRAM';
                 else if (prefix === 0xA01 || prefix === 0xA10) {
                   if (sym.addr >= 0xA1040000 && sym.addr < 0xA1060000) rName = 'IMR';
                   else rName = 'LPSRAM';
                 }
              }
              if (rName) {
                 if (!regions[rName]) regions[rName] = [];
                 regions[rName].push(sym);
              }
            }
          });

          const activeRegions = Object.keys(regions)
            .map(rName => {
               const sortedSyms = regions[rName].sort((a,b) => a.addr - b.addr);
               let base = sortedSyms[0] ? sortedSyms[0].addr : 0;
               if (regionsMeta && regionsMeta.length > 0) {
                  const rm = regionsMeta.find(r => r.name === rName);
                  if (rm) base = rm.start;
               }
               return { name: rName, base: base, syms: sortedSyms };
            })
            .sort((a,b) => a.base - b.base);

          activeRegions.forEach(regionData => {
            const rName = regionData.name;
            const sorted = regionData.syms;
            let sumSize = 0;
            sorted.forEach(s => sumSize += s.size);

            const rDiv = document.createElement('div');
            rDiv.className = 'memory-region';
            const rTitle = document.createElement('h3');
            rTitle.textContent = rName + ' (Total Explicit Load: ' + sumSize + ' bytes, Objects: ' + regions[rName].length + ')';
            rDiv.appendChild(rTitle);

            const blocksDiv = document.createElement('div');
            blocksDiv.className = 'memory-blocks';
            blocksDiv.style.display = 'block'; // Override flex, we will use individual bank rows natively
            
            // Resolve boundary arrays
            let minAddr = sorted[0] ? sorted[0].addr : 0;
            let maxAddr = sorted.length ? sorted[sorted.length - 1].addr + sorted[sorted.length - 1].size : 0;

            if (regionsMeta && regionsMeta.length > 0) {
               const rm = regionsMeta.find(r => r.name === rName);
               if (rm) {
                  minAddr = rm.start;
                  maxAddr = rm.end + 1;
               }
            }

            let bankSize = 131072; // 32 pages explicit hardware fallback
            let explicitBankCount = null;
            const sramTops = sramTopologies;
            if (sramTops && sramTops.length > 0) {
               const st = sramTops.find(s => rName.toLowerCase().replace(/-/g, '').includes(s.name.toLowerCase().replace(/-/g, '')));
               if (st) {
                  if (st.bankSize) bankSize = st.bankSize;
                  if (st.banks) explicitBankCount = st.banks;
               }
            }
            if (explicitBankCount === null) {
                // unless size is smaller than 32 pages
                bankSize = Math.min(bankSize, Math.max(4096, maxAddr - minAddr)); 
            }
            
            minAddr = Math.floor(minAddr / bankSize) * bankSize; // Protect against JS 32-bit signed bitwise limits safely
            const bankCount = explicitBankCount !== null ? explicitBankCount : (Math.ceil((maxAddr - minAddr) / bankSize) || 1);
            
            for (let idx = 0; idx < bankCount; idx++) {
              const bankBase = minAddr + (idx * bankSize);
              const bankLimit = bankBase + bankSize;
              
              const insideBank = sorted.filter(s => s.addr < bankLimit && (s.addr + s.size) > bankBase);
              
              const bDiv = document.createElement('div');
              bDiv.className = 'memory-bank';
              bDiv.style.position = 'relative';
              bDiv.style.height = '35px';
              bDiv.style.marginBottom = '6px';
              bDiv.style.backgroundColor = 'rgba(0,0,0,0.1)';
              bDiv.style.border = '1px solid var(--vscode-editorGroup-border)';
              bDiv.title = rName + ' Bank ' + idx + ' (0x' + bankBase.toString(16).toUpperCase() + ')';
              bDiv.className = 'bank-row';
              bDiv.dataset.base = bankBase.toString();
              bDiv.dataset.size = bankSize.toString();
              
              const startLabel = document.createElement('span');
              startLabel.className = 'start-label';
              startLabel.textContent = '0x' + bankBase.toString(16).toUpperCase();
              startLabel.style.position = 'absolute';
              startLabel.style.left = '2px';
              startLabel.style.top = '2px';
              startLabel.style.fontSize = '10px';
              startLabel.style.color = '#fff';
              startLabel.style.background = 'rgba(0,0,0,0.6)';
              startLabel.style.padding = '0 3px';
              startLabel.style.zIndex = '5';
              
              const endLabel = document.createElement('span');
              endLabel.className = 'end-label';
              endLabel.textContent = '0x' + (bankLimit - 1).toString(16).toUpperCase();
              endLabel.style.position = 'absolute';
              endLabel.style.left = '100px'; // Set dynamically by Javascript updateEdgeLabels
              endLabel.style.top = '2px';
              endLabel.style.fontSize = '10px';
              endLabel.style.color = '#fff';
              endLabel.style.background = 'rgba(0,0,0,0.6)';
              endLabel.style.padding = '0 3px';
              endLabel.style.zIndex = '5';
              
              bDiv.appendChild(startLabel);
              bDiv.appendChild(endLabel);
              
              for (let offset = 4096; offset < bankSize; offset += 4096) {
                   const label = document.createElement('span');
                   label.textContent = '0x' + (bankBase + offset).toString(16).toUpperCase();
                   label.style.position = 'absolute';
                   label.style.left = ((offset / bankSize) * 100) + '%';
                   label.style.top = '2px';
                   label.style.fontSize = '9px';
                   label.style.color = 'rgba(255,255,255,0.7)';
                   label.style.background = 'rgba(0,0,0,0.5)';
                   label.style.padding = '0 2px';
                   label.style.zIndex = '4';
                   label.style.transform = 'translate(-50%, 0)';
                   label.style.pointerEvents = 'none';
                   label.className = 'addr-marker';
                   
                   if (offset % 65536 === 0) label.dataset.z = '2.0';
                   else if (offset % 32768 === 0) label.dataset.z = '5.0';
                   else if (offset % 16384 === 0) label.dataset.z = '12.0';
                   else if (offset % 8192 === 0) label.dataset.z = '25.0';
                   else label.dataset.z = '50.0';
                   
                   label.style.display = (window.__memMapState.mapZoom >= parseFloat(label.dataset.z)) ? 'block' : 'none';
                   bDiv.appendChild(label);
              }

              const pagePct = (4096 / bankSize) * 100;
              bDiv.style.backgroundImage = 'linear-gradient(to right, transparent calc(100% - 1px), var(--vscode-editorGroup-border) 100%)';
              bDiv.style.backgroundSize = pagePct + '% 100%';
              
              insideBank.forEach(sym => {
                const sb = createMemBlock(sym, bankBase, bankSize);
                bDiv.appendChild(sb);
              });
              blocksDiv.appendChild(bDiv);
              
              const ringRow = document.createElement('div');
              const asidRow = document.createElement('div');
              const attrRow = document.createElement('div');
              const vaddrRow = document.createElement('div');
              
              const rowStyle = 'display: flex; width: 100%; height: 12px; margin-bottom: 1px;';
              ringRow.style.cssText = rowStyle;
              asidRow.style.cssText = rowStyle;
              attrRow.style.cssText = rowStyle;
              vaddrRow.style.cssText = rowStyle + 'margin-bottom: 6px;';
              
              for (let offset = 0; offset < bankSize; offset += 4096) {
                  const pg = bankBase + offset;
                  
                  let extRing = null;
                  let extAsid = null;
                  let extAttr = null;
                  let extDelta = null;
                  
                  for (let i = tlbRanges.length - 1; i >= 0; i--) {
                      if (pg >= tlbRanges[i].start && pg < tlbRanges[i].end) {
                          if (extRing === null && tlbRanges[i].attr.ring !== undefined) extRing = tlbRanges[i].attr.ring;
                          if (extAsid === null && tlbRanges[i].attr.asid !== undefined) extAsid = tlbRanges[i].attr.asid;
                          if (extAttr === null && tlbRanges[i].attr.attr !== undefined) extAttr = tlbRanges[i].attr.attr;
                          if (extDelta === null && tlbRanges[i].attr.vaddr !== undefined) extDelta = tlbRanges[i].attr.vaddr;
                          if (extRing !== null && extAsid !== null && extAttr !== null && extDelta !== null) break;
                      }
                  }
                  
                  const rootPg = pageAttributes[pg] || { ring: '0', asid: '0x0', attr: '0x0', vaddr: 0 };
                  if (extRing === null) extRing = rootPg.ring !== undefined ? rootPg.ring : '0';
                  if (extAsid === null) extAsid = rootPg.asid !== undefined ? rootPg.asid : '0x0';
                  if (extAttr === null) extAttr = rootPg.attr !== undefined ? rootPg.attr : '0x0';
                  if (extDelta === null) extDelta = rootPg.vaddr !== undefined ? rootPg.vaddr : 0;
                  
                  const pgAttr = { ring: extRing, asid: extAsid, attr: extAttr, vaddr: extDelta };
                  
                  const rDiv = document.createElement('div');
                  const aDiv = document.createElement('div');
                  const atDiv = document.createElement('div');
                  const vDiv = document.createElement('div');
                  
                  const cellStyle = 'flex: 1; min-width: 0; border: 1px solid var(--vscode-editorGroup-border); box-sizing: border-box; font-size: 8px; text-align: center; overflow: hidden; display: flex; align-items: center; justify-content: center;';
                  
                  rDiv.style.cssText = cellStyle;
                  aDiv.style.cssText = cellStyle;
                  atDiv.style.cssText = cellStyle;
                  vDiv.style.cssText = cellStyle;
                  
                  const r = pgAttr.ring || '?';
                  const asidNode = pgAttr.asid === '0xff' ? 'FF' : pgAttr.asid.replace('0x', '');
                  const attrHex = pgAttr.attr.replace('0x', '').toUpperCase();
                  
                  const attrAbbrev = {
                      '0': 'Ill',
                      '1': 'WT KRW',
                      '2': 'WT KRWX',
                      '3': 'Bypass',
                      '4': 'WB KRW',
                      '5': 'WB KRWX',
                      '6': 'WB URW',
                      '7': 'WB URWX',
                      '8': 'WT URW',
                      '9': 'WT URWX',
                      'A': 'UG KRW',
                      'B': 'UG KRWX',
                      'C': 'UG URW',
                      'D': 'UG URWX',
                      'E': 'Isolated',
                      'F': 'UC KRWX'
                  };
                  const attrTitles = {
                      '0': 'Illegal / Unmapped (Triggers exception)',
                      '1': 'Write-Through, Kernel (R/W)',
                      '2': 'Write-Through, Kernel (R/W/X)',
                      '3': 'Cache Bypass, Full R/W/X for ALL Rings (Power-On)',
                      '4': 'Write-Back, Kernel (R/W)',
                      '5': 'Write-Back, Kernel (R/W/X)',
                      '6': 'Write-Back, Userspace (R/W)',
                      '7': 'Write-Back, Userspace (R/W/X)',
                      '8': 'Write-Through, Userspace (R/W)',
                      '9': 'Write-Through, Userspace (R/W/X)',
                      'A': 'Cache Bypass, Kernel (R/W)',
                      'B': 'Cache Bypass, Kernel (R/W/X)',
                      'C': 'Cache Bypass, Userspace (R/W)',
                      'D': 'Cache Bypass, Userspace (R/W/X)',
                      'E': 'Platform Specific / Isolated RAM',
                      'F': 'Cache Bypass, Kernel R/W/X (MMIO / Dev Regs)'
                  };
                  
                  rDiv.textContent = 'R:' + r;
                  aDiv.textContent = 'A:' + asidNode;
                  atDiv.textContent = attrAbbrev[attrHex] || attrHex;
                  
                  const vrt = (pg + pgAttr.vaddr) >>> 0;
                  const attrDesc = attrTitles[attrHex] ? ' (' + attrTitles[attrHex] + ')' : '';
                  let titleStr = 'Page (P): 0x' + pg.toString(16).toUpperCase() + '\nPage (V): ' + (pgAttr.vaddr !== 0 ? '0x' + vrt.toString(16).toUpperCase() : 'P==V') + '\nASID: ' + pgAttr.asid + '\nAttr: ' + pgAttr.attr + attrDesc + (r !== '?' ? '\nRing: ' + r : '');
                  
                  let historyLog = '\n\n--- TLB History ---';
                  let changeCount = 0;
                  let currRing = '0';
                  let currAsid = '0x0';
                  let currAttr = '0x0';
                  let currVaddr = 0;
                  
                  for (let i = 0; i < tlbRanges.length; i++) {
                      if (pg >= tlbRanges[i].start && pg < tlbRanges[i].end) {
                          const t = tlbRanges[i].attr;
                          let changed = false;
                          let stepStr = '[' + (changeCount+1) + '] ';
                          
                          const nextRing = t.ring !== undefined ? t.ring : currRing;
                          const nextAsid = t.asid !== undefined ? t.asid : currAsid;
                          const nextAttr = t.attr !== undefined ? t.attr : currAttr;
                          const nextVaddr = t.vaddr !== undefined ? t.vaddr : currVaddr;
                          
                          if (nextRing !== currRing) { stepStr += 'Ring:' + currRing + '->' + nextRing + ' '; currRing = nextRing; changed = true; }
                          if (nextAsid !== currAsid) { stepStr += 'ASID:' + currAsid + '->' + nextAsid + ' '; currAsid = nextAsid; changed = true; }
                          if (nextAttr !== currAttr) { stepStr += 'Attr:' + currAttr + '->' + nextAttr + ' '; currAttr = nextAttr; changed = true; }
                          if (nextVaddr !== currVaddr) {
                              const currHex = (pg + currVaddr) >>> 0;
                              const nextHex = (pg + nextVaddr) >>> 0;
                              stepStr += 'VAddr:0x' + currHex.toString(16).toUpperCase() + '->0x' + nextHex.toString(16).toUpperCase() + ' '; 
                              currVaddr = nextVaddr; 
                              changed = true; 
                          }
                          
                          if (changed) {
                              historyLog += '\n' + stepStr.trim();
                              changeCount++;
                          }
                      }
                  }
                  if (changeCount === 0) historyLog += '\n(No changes from base state)';
                  titleStr += historyLog;

                  rDiv.title = titleStr;
                  aDiv.title = titleStr;
                  atDiv.title = titleStr;
                  vDiv.title = titleStr;
                  
                  const defBg = 'rgba(56, 142, 60, 0.3)';
                  
                  let rBg = defBg;
                  if (r === '1') rBg = 'rgba(211, 47, 47, 0.5)';
                  else if (r === '2') rBg = 'rgba(156, 39, 176, 0.5)';
                  else if (r === '3') rBg = 'rgba(103, 58, 183, 0.5)';
                  
                  let aBg = defBg;
                  if (asidNode !== '0' && asidNode !== '0x0' && asidNode !== 'FF') {
                      const idVal = parseInt(asidNode, 16) || 0;
                      aBg = 'hsla(' + ((idVal * 137.5) % 360) + ', 70%, 40%, 0.5)';
                  }
                  
                  let atBg = defBg;
                  if (attrHex === '0') atBg = 'rgba(156, 39, 176, 0.5)';
                  else if (['6', '7', '8', '9', 'C', 'D'].includes(attrHex)) atBg = 'rgba(211, 47, 47, 0.5)';
                  
                  let vBg = defBg;
                  if (pgAttr.vaddr === 0) {
                      vDiv.textContent = 'P==V';
                  } else {
                      let hexCut = vrt.toString(16).toUpperCase();
                      vDiv.textContent = hexCut;
                      vBg = 'rgba(33, 150, 243, 0.5)'; // Blue alias
                  }
                  
                  rDiv.style.backgroundColor = rBg;
                  aDiv.style.backgroundColor = aBg;
                  atDiv.style.backgroundColor = atBg;
                  vDiv.style.backgroundColor = vBg;
                  
                  rDiv.style.color = '#fff';
                  aDiv.style.color = '#fff';
                  atDiv.style.color = '#fff';
                  vDiv.style.color = '#fff';
                  
                  ringRow.appendChild(rDiv);
                  asidRow.appendChild(aDiv);
                  attrRow.appendChild(atDiv);
                  vaddrRow.appendChild(vDiv);
              }
              blocksDiv.appendChild(ringRow);
              blocksDiv.appendChild(asidRow);
              blocksDiv.appendChild(attrRow);
              blocksDiv.appendChild(vaddrRow);
            }
            
            const mapScroll = document.createElement('div');
            mapScroll.className = 'map-scrollable';
            const mapInner = document.createElement('div');
            mapInner.className = 'map-inner';
            mapInner.appendChild(blocksDiv);
            mapScroll.appendChild(mapInner);
            
            rDiv.appendChild(mapScroll);
            container.appendChild(rDiv);
          });
        // --------------------------------------------------------------------------------
        // Virtual Memory Map (Dynamically Mapped Aliases Only)
        // --------------------------------------------------------------------------------
        
        const vDiv = document.createElement('div');
        vDiv.className = 'memory-region';
        const vTitle = document.createElement('h3');
        vTitle.textContent = 'Virtual Memory Map (Dynamically Mapped Aliases)';
        vDiv.appendChild(vTitle);
        
        const mapScrollV = document.createElement('div');
        mapScrollV.className = 'map-scrollable';
        const mapInnerV = document.createElement('div');
        mapInnerV.className = 'map-inner';
        const vBlocksDiv = document.createElement('div');
        vBlocksDiv.className = 'memory-blocks';
        vBlocksDiv.style.display = 'block';
        
        const mappedVBanks = new Set();
        for (let i = 0; i < tlbRanges.length; i++) {
            const tr = tlbRanges[i];
            if (tr.attr && tr.attr.vaddr !== undefined) {
                // Identity mappings (P == V) cover huge 2GB+ areas. Filter them out tightly
                if (tr.attr.vaddr === 0) continue; 
                
                // Add bounding constraints structurally stopping DOM freeze
                if (mappedVBanks.size > 150) break; 
                
                // Iterate exclusively in bank-sized striding natively
                const startBank = ((tr.start + tr.attr.vaddr) >>> 0) - (((tr.start + tr.attr.vaddr) >>> 0) % 131072);
                const endBank = ((tr.end - 1 + tr.attr.vaddr) >>> 0) - (((tr.end - 1 + tr.attr.vaddr) >>> 0) % 131072);
                
                for (let b = startBank; b <= endBank; b += 131072) {
                    mappedVBanks.add(b >>> 0);
                    if (mappedVBanks.size > 150) break;
                }
            }
        }
        
        const vBanksSorted = Array.from(mappedVBanks).sort((a, b) => a - b);
        
        vBanksSorted.forEach(bankBase => {
          const bankSize = 131072;
          const bankLimit = bankBase + bankSize;
          
          const bDiv = document.createElement('div');
          bDiv.className = 'memory-bank bank-row';
          bDiv.style.position = 'relative';
          bDiv.style.height = '35px';
          bDiv.style.marginBottom = '6px';
          bDiv.style.backgroundColor = 'rgba(0,0,0,0.1)';
          bDiv.style.border = '1px solid var(--vscode-editorGroup-border)';
          bDiv.title = 'Virtual Bank (0x' + bankBase.toString(16).toUpperCase() + ')';
          bDiv.dataset.base = bankBase.toString();
          bDiv.dataset.size = bankSize.toString();
          
          const startLabel = document.createElement('span');
          startLabel.className = 'start-label';
          startLabel.textContent = '0x' + bankBase.toString(16).toUpperCase();
          startLabel.style.position = 'absolute';
          startLabel.style.left = '2px';
          startLabel.style.top = '2px';
          startLabel.style.fontSize = '10px';
          startLabel.style.color = '#fff';
          startLabel.style.background = 'rgba(0,0,0,0.6)';
          startLabel.style.padding = '0 3px';
          startLabel.style.zIndex = '5';
          
          const endLabel = document.createElement('span');
          endLabel.className = 'end-label';
          endLabel.textContent = '0x' + (bankLimit - 1).toString(16).toUpperCase();
          endLabel.style.position = 'absolute';
          endLabel.style.left = '100px'; 
          endLabel.style.top = '2px';
          endLabel.style.fontSize = '10px';
          endLabel.style.color = '#fff';
          endLabel.style.background = 'rgba(0,0,0,0.6)';
          endLabel.style.padding = '0 3px';
          endLabel.style.zIndex = '5';
          
          bDiv.appendChild(startLabel);
          bDiv.appendChild(endLabel);
          
          for (let offset = 4096; offset < bankSize; offset += 4096) {
               const label = document.createElement('span');
               label.textContent = '0x' + (bankBase + offset).toString(16).toUpperCase();
               label.style.position = 'absolute';
               label.style.left = ((offset / bankSize) * 100) + '%';
               label.style.top = '2px';
               label.style.fontSize = '9px';
               label.style.color = 'rgba(255,255,255,0.7)';
               label.style.background = 'rgba(0,0,0,0.5)';
               label.style.padding = '0 2px';
               label.style.zIndex = '4';
               label.style.transform = 'translate(-50%, 0)';
               label.style.pointerEvents = 'none';
               label.className = 'addr-marker';
               
               if (offset % 65536 === 0) label.dataset.z = '2.0';
               else if (offset % 32768 === 0) label.dataset.z = '5.0';
               else if (offset % 16384 === 0) label.dataset.z = '12.0';
               else if (offset % 8192 === 0) label.dataset.z = '25.0';
               else label.dataset.z = '50.0';
               
               label.style.display = (window.__memMapState.mapZoom >= parseFloat(label.dataset.z)) ? 'block' : 'none';
               bDiv.appendChild(label);
          }
          
          const pagePct = (4096 / bankSize) * 100;
          bDiv.style.backgroundImage = 'linear-gradient(to right, transparent calc(100% - 1px), var(--vscode-editorGroup-border) 100%)';
          bDiv.style.backgroundSize = pagePct + '% 100%';
          
          if (symbolsData) {
              const insideBank = [];
              symbolsData.forEach(sym => {
                   const symPEnd = sym.addr + sym.size;
                   
                   for (let i = 0; i < tlbRanges.length; i++) {
                       const tr = tlbRanges[i];
                       if (tr.attr && tr.attr.vaddr !== undefined && tr.attr.vaddr !== 0) {
                           const overlapStart = Math.max(sym.addr, tr.start);
                           const overlapEnd = Math.min(symPEnd, tr.end);
                           
                           if (overlapStart < overlapEnd) {
                               const extDelta = tr.attr.vaddr;
                               const vStart = (overlapStart + extDelta) >>> 0;
                               const vEnd = (overlapEnd + extDelta) >>> 0;
                               
                               if (vStart < bankLimit && vEnd > bankBase) {
                                   const clippedSize = vEnd - vStart;
                                   insideBank.push(Object.assign({}, sym, { addr: vStart, size: clippedSize }));
                               }
                           }
                       }
                   }
              });
              
              const dedupedInside = [];
              const seenVirtualBounds = new Set();
              insideBank.forEach(b => {
                 const key = b.addr + '-' + b.size + '-' + b.name;
                 if (!seenVirtualBounds.has(key)) {
                     seenVirtualBounds.add(key);
                     dedupedInside.push(b);
                 }
              });
              
              dedupedInside.forEach(sym => {
                  const sb = createMemBlock(sym, bankBase, bankSize);
                  bDiv.appendChild(sb);
              });
          }
          
          const ringRow = document.createElement('div');
          const asidRow = document.createElement('div');
          const attrRow = document.createElement('div');
          const paddrRow = document.createElement('div');
          
          const rowStyle = 'display: flex; width: 100%; height: 12px; margin-bottom: 1px;';
          ringRow.style.cssText = rowStyle;
          asidRow.style.cssText = rowStyle;
          attrRow.style.cssText = rowStyle;
          paddrRow.style.cssText = rowStyle + 'margin-bottom: 6px;';
          
          for (let offset = 0; offset < bankSize; offset += 4096) {
              const vPg = (bankBase + offset) >>> 0;
              
              let extRing = null;
              let extAsid = null;
              let extAttr = null;
              let extPaddrDelta = null;
              let pPg = null;
              
              for (let i = tlbRanges.length - 1; i >= 0; i--) {
                  if (tlbRanges[i].attr && tlbRanges[i].attr.vaddr !== undefined) {
                      const vS = (tlbRanges[i].start + tlbRanges[i].attr.vaddr) >>> 0;
                      const vE = (tlbRanges[i].end + tlbRanges[i].attr.vaddr) >>> 0;
                      if (vPg >= vS && vPg < vE) {
                          if (extRing === null && tlbRanges[i].attr.ring !== undefined) extRing = tlbRanges[i].attr.ring;
                          if (extAsid === null && tlbRanges[i].attr.asid !== undefined) extAsid = tlbRanges[i].attr.asid;
                          if (extAttr === null && tlbRanges[i].attr.attr !== undefined) extAttr = tlbRanges[i].attr.attr;
                          if (extPaddrDelta === null) {
                              extPaddrDelta = -tlbRanges[i].attr.vaddr;
                              pPg = (vPg + extPaddrDelta) >>> 0;
                          }
                          if (extRing !== null && extAsid !== null && extAttr !== null && extPaddrDelta !== null) break;
                      }
                  }
              }
              
              const rDiv = document.createElement('div');
              const aDiv = document.createElement('div');
              const atDiv = document.createElement('div');
              const pDiv = document.createElement('div');
              
              const cellStyle = 'flex: 1; min-width: 0; border: 1px solid var(--vscode-editorGroup-border); box-sizing: border-box; font-size: 8px; text-align: center; overflow: hidden; display: flex; align-items: center; justify-content: center;';
              rDiv.style.cssText = cellStyle;
              aDiv.style.cssText = cellStyle;
              atDiv.style.cssText = cellStyle;
              pDiv.style.cssText = cellStyle;
              
              if (extRing === null) {
                  rDiv.style.borderColor = 'transparent';
                  aDiv.style.borderColor = 'transparent';
                  atDiv.style.borderColor = 'transparent';
                  pDiv.style.borderColor = 'transparent';
              } else {
                  const r = extRing;
                  const asidNode = extAsid === '0xff' ? 'FF' : extAsid.replace('0x', '');
                  const attrHex = extAttr.replace('0x', '').toUpperCase();
                  
                  const attrTitles = {
                      '0': 'Illegal / Unmapped (Triggers exception)',
                      '1': 'Write-Through, Kernel (R/W)',
                      '2': 'Write-Through, Kernel (R/W/X)',
                      '3': 'Cache Bypass, Full R/W/X for ALL Rings (Power-On)',
                      '4': 'Write-Back, Kernel (R/W)',
                      '5': 'Write-Back, Kernel (R/W/X)',
                      '6': 'Write-Back, Userspace (R/W)',
                      '7': 'Write-Back, Userspace (R/W/X)',
                      '8': 'Write-Through, Userspace (R/W)',
                      '9': 'Write-Through, Userspace (R/W/X)',
                      'A': 'UG / Cacheable KRW',
                      'B': 'UG / Cacheable KRWX',
                      'C': 'UG / Cacheable URW',
                      'D': 'Cache Bypass, Userspace (R/W/X)',
                      'E': 'Platform Specific / Isolated RAM',
                      'F': 'Cache Bypass, Kernel R/W/X (MMIO / Dev Regs)'
                  };
                  
                  rDiv.textContent = 'R:' + r;
                  aDiv.textContent = 'A:' + asidNode;
                  atDiv.textContent = attrHex;
                  
                  const attrDesc = attrTitles[attrHex] ? ' (' + attrTitles[attrHex] + ')' : '';
                  const titleStr = 'Page (V): 0x' + vPg.toString(16).toUpperCase() + '\nPage (P): ' + (extPaddrDelta !== 0 ? '0x' + pPg.toString(16).toUpperCase() : 'P==V') + '\nASID: ' + extAsid + '\nAttr: ' + extAttr + attrDesc + '\nRing: ' + r;
                  rDiv.title = titleStr;
                  aDiv.title = titleStr;
                  atDiv.title = titleStr;
                  pDiv.title = titleStr;
                  
                  const defBg = 'rgba(56, 142, 60, 0.3)';
                  let rBg = defBg;
                  if (r === '1') rBg = 'rgba(211, 47, 47, 0.5)';
                  else if (r === '2') rBg = 'rgba(156, 39, 176, 0.5)';
                  else if (r === '3') rBg = 'rgba(103, 58, 183, 0.5)';
                  
                  let aBg = defBg;
                  if (asidNode !== '0' && asidNode !== '0x0' && asidNode !== 'FF') {
                      const idVal = parseInt(asidNode, 16) || 0;
                      aBg = 'hsla(' + ((idVal * 137.5) % 360) + ', 70%, 40%, 0.5)';
                  }
                  
                  let atBg = defBg;
                  if (attrHex === '0') atBg = 'rgba(156, 39, 176, 0.5)';
                  else if (['6', '7', '8', '9', 'C', 'D'].includes(attrHex)) atBg = 'rgba(211, 47, 47, 0.5)';
                  
                  let pBg = defBg;
                  if (extPaddrDelta === 0) {
                      pDiv.textContent = 'P==V';
                  } else {
                      let hexCut = pPg.toString(16).toUpperCase();
                      pDiv.textContent = hexCut;
                      pBg = 'rgba(33, 150, 243, 0.5)'; // Blue alias
                  }
                  
                  rDiv.style.backgroundColor = rBg;
                  aDiv.style.backgroundColor = aBg;
                  atDiv.style.backgroundColor = atBg;
                  pDiv.style.backgroundColor = pBg;
                  
                  rDiv.style.color = '#fff';
                  aDiv.style.color = '#fff';
                  atDiv.style.color = '#fff';
                  pDiv.style.color = '#fff';
              }
              
              ringRow.appendChild(rDiv);
              asidRow.appendChild(aDiv);
              attrRow.appendChild(atDiv);
              paddrRow.appendChild(pDiv);
          }
          vBlocksDiv.appendChild(bDiv);
          vBlocksDiv.appendChild(ringRow);
          vBlocksDiv.appendChild(asidRow);
          vBlocksDiv.appendChild(attrRow);
          vBlocksDiv.appendChild(paddrRow);
        });
        
        mapInnerV.appendChild(vBlocksDiv);
        mapScrollV.appendChild(mapInnerV);
        vDiv.appendChild(mapScrollV);
        container.appendChild(vDiv);
        
        // --- DOUBLE-BUFFERING LAYER SWAP ---
        if (oldContainer) oldContainer.remove();
        container.id = 'memory-map-container';
        layoutContainer.appendChild(container);
        
        // Restore DOM states natively scaling over UI variables mapped explicitly
        if (!window.__memMapState.scrollOffsets) window.__memMapState.scrollOffsets = {};
        container.querySelectorAll('.map-scrollable').forEach(s => {
            if (window.__memMapState.scrollOffsets[s.id] !== undefined) {
                s.scrollLeft = window.__memMapState.scrollOffsets[s.id];
            }
        });
        
        commitRedraw();
        }
        
        // Truncate evaluation logic below 'vmh_alloc' because internal parameters duplicate pointer shifts corrupting boundaries.
        function isAllocCall(name, stackChain = []) {
           if (!name) return false;
           if (stackChain.includes('vmh_alloc')) return false;
           const n = name.toLowerCase();
           if (n.includes('free') || n.includes('chunk')) return false;
           return n.includes('alloc') || n.includes('rzalloc') || n.includes('vmh_alloc') || n.includes('heap_alloc');
        }

        function createMemBlock(sym, baseAddr, planeSize) {
           const sb = document.createElement('div');
           sb.className = 'mem-block';
           sb.id = 'mem-block-' + sym.addr.toString(16);
           sb.style.position = 'absolute';
           sb.style.height = '100%';

           let bg = 'var(--vscode-editor-selectionBackground)';
           let fg = '#fff';

           // Explicitly intercept and mark Heap Allocations in High Contrast Red natively 
           if (sym.sect === 'heap_dyn' || (sym.name && sym.name.toLowerCase().includes('heap'))) {
               bg = 'rgba(211, 47, 47, 0.4)'; // Red
               fg = '#fff';
           } else if (sym.sect === 'text') {
               bg = 'rgba(25, 118, 210, 0.4)'; // Blue
           } else if (sym.sect === 'rodata') {
               bg = 'rgba(56, 142, 60, 0.4)'; // Green
           } else if (sym.sect === 'data') { 
               bg = 'rgba(129, 199, 132, 0.4)'; // Light Green
               fg = '#000'; 
           } else if (sym.sect === 'bss') {
               bg = 'rgba(123, 31, 162, 0.4)'; // Purple
           }

           sb.style.backgroundColor = bg;
           sb.style.borderRight = '1px solid rgba(255,255,255,0.3)';
           sb.style.overflow = 'hidden';
           sb.style.display = 'flex';
           sb.style.alignItems = 'center';
           sb.style.justifyContent = 'center';
           sb.style.fontSize = '10px';
           sb.style.color = fg;
           sb.style.cursor = 'pointer';
           
           const offset = Math.max(0, sym.addr - baseAddr);
           // Calculate mapped proportional explicit geometries strictly capping over structural frames
           const visibleSize = Math.min(sym.size, planeSize - offset); 
           
           sb.style.left = ((offset / planeSize) * 100) + '%';
           sb.style.width = ((visibleSize / planeSize) * 100) + '%';
           
           let displayName = sym.name;
           if (sym.stackChain && sym.stackChain.length > 0) {
               displayName = sym.stackChain[sym.stackChain.length - 1]; 
               for (let i = sym.stackChain.length - 1; i >= 0; i--) {
                   if (!isAllocCall(sym.stackChain[i])) {
                       displayName = sym.stackChain[i];
                       break;
                   }
               }
           }

           let titleText = displayName + ' \nAddr: 0x' + sym.addr.toString(16) + '\nLayout Size: ' + sym.size + ' bytes';
           if (sym.file) titleText += '\nFile: ' + sym.file + ':' + (sym.line || 1);
           sb.title = titleText;
           
           // Natively drop internal textual overlays truncating visually dense geometries
           if (((visibleSize / planeSize) * 100) > 3) sb.textContent = displayName; 
           
           sb.ondblclick = (e) => {
               e.stopPropagation();
               if (sym.sect === 'heap_dyn' && sym.caller) {
                   const callerSym = symbolsData.find(s => s.name === sym.caller);
                   if (callerSym && callerSym.file) {
                       vscode.postMessage({ command: 'openSource', file: callerSym.file, line: callerSym.line || 1 });
                   } else if (sym.file) {
                       vscode.postMessage({ command: 'openSource', file: sym.file, line: sym.line || 1 });
                   }
               } else if (sym.file) {
                   vscode.postMessage({ command: 'openSource', file: sym.file, line: sym.line || 1 });
               }
           };
           
           sb.onclick = (e) => {
               e.stopPropagation();
               const allocNode = document.getElementById('alloc-node-' + sym.addr.toString(16));
               if (allocNode) {
                    const blockTarget = document.getElementById('mem-block-' + sym.addr.toString(16));
                    if (blockTarget) {
                        blockTarget.classList.remove('flash-target');
                        void blockTarget.offsetWidth;
                        blockTarget.classList.add('flash-target');
                    }
                    
                    const summaries = allocNode.querySelectorAll('summary');
                    if (summaries && summaries.length > 0) {
                        const prev = document.querySelector('.alloc-item summary.selected');
                        if (prev) prev.classList.remove('selected');
                        summaries[0].classList.add('selected');
                    }
                    
                    allocNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // Open the top-level details recursively evaluating structural hierarchies seamlessly!
                    const detailsNode = allocNode.querySelector('details');
                    if (detailsNode) detailsNode.open = true;
               }
           };

           return sb;
        }