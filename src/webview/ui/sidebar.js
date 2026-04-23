        function renderSidebar() {
          const sidebar = document.getElementById('tree-sidebar');
          if (!sidebar) return;
          const root = document.createElement('div');
          
          let stack = [root];
          
          for (let i = 0; i < logData.length; i++) {
            const p = logData[i];
            if (p.funcAddr !== undefined) {
              if (p.funcArgs) {
                const nameLabel = p.funcName ? p.funcName : '0x' + p.funcAddr.toString(16);
                const details = document.createElement('details');
                const summary = document.createElement('summary');
                
                summary.textContent = nameLabel + ' (a2...a7: ' + p.funcArgs.join(', ') + ')';
                
                if (p.file) {
                  summary.dataset.file = p.file;
                  if (p.line !== undefined) summary.dataset.line = p.line.toString();
                }

                summary.ondblclick = (e) => {
                  if (summary.dataset.file) {
                    vscode.postMessage({ command: 'openSource', file: summary.dataset.file, line: parseInt(summary.dataset.line, 10) });
                  }
                };

                summary.onclick = (e) => {
                  const prev = document.querySelector('summary.selected');
                  if (prev) prev.classList.remove('selected');
                  summary.classList.add('selected');

                  if (window.myChart) {
                    const start = p.t / 38420000.0;
                    let end = start;
                    if (details.dataset.endT) {
                      end = parseFloat(details.dataset.endT) / 38420000.0;
                    }
                    let duration = end - start;
                    if (duration === 0) duration = 0.001; // Scale arbitrarily only for instantaneous execution bounds avoiding div-zero rendering crashes implicitly explicitly inherently!
                    
                    // The border events sequentially mirror precisely 0.5x the length of the selected function purely
                    const padding = duration * 0.5; 
                    
                    window.myChart.options.scales.x.min = start - padding;
                    window.myChart.options.scales.x.max = end + padding;
                    window.myChart.update();
                  }
                };

                details.appendChild(summary);
                details.dataset.startT = p.t;
                
                // Chrome's renderer will abort layout calculations and silently blank the UI
                // if the DOM layout tree is nested too deeply recursively (e.g. Unclosed traces).
                // Safely cap visual trace nesting to a depth of 250!
                if (stack.length > 250) {
                    stack[stack.length - 2].appendChild(details); // append parallel to existing depth cap
                    // Maintain the virtual abstraction so returning pops cleanly when the buffer naturally recedes
                    stack.push(details); 
                } else {
                    stack[stack.length - 1].appendChild(details);
                    stack.push(details);
                }
              } else if (p.funcRet) {
                if (stack.length > 1) {
                  const currentDetails = stack.pop();
                  currentDetails.dataset.endT = p.t;
                  const sum = currentDetails.querySelector('summary');
                  if (sum) {
                    sum.textContent += ' -> a2=' + p.funcRet;
                  }
                }
              }
            } else if (p.raw && p.raw.toLowerCase().includes('privilege error')) {
                if (stack.length > 0) {
                  // Only auto-expand ALL parent <details> nodes and color their text red, do not add an inline node!
                  for (let j = 1; j < stack.length; j++) {
                      if (stack[j].tagName === 'DETAILS') {
                          stack[j].open = true;
                          const sum = stack[j].querySelector('summary');
                          if (sum) {
                              sum.style.color = '#ff0000';
                              sum.style.fontWeight = 'bold';
                          }
                      }
                  }
                }
            }
          }
          sidebar.appendChild(root);
        }

        // Initialize Call-Stack sidebar automatically
        renderSidebar();

        function searchTree(query) {
          query = query.toLowerCase();
          const tree = document.getElementById('tree-sidebar');
          if (!tree) return;
          
          function traverse(node) {
            if (node.tagName === 'SUMMARY') return false;
            if (node.tagName === 'DETAILS') {
              const summary = node.querySelector('summary');
              const text = summary ? summary.textContent.toLowerCase() : '';
              let matches = text.includes(query);
              
              const children = node.children;
              for (let i = 0; i < children.length; i++) {
                if (children[i].tagName === 'DETAILS') {
                  const childMatches = traverse(children[i]);
                  if (childMatches) matches = true;
                }
              }
              
              node.style.display = matches ? '' : 'none';
              if (query && matches) node.open = true;
              return matches;
            }
            
            let anyMatch = false;
            const children = node.children;
            for (let i = 0; i < children.length; i++) {
              if (children[i].tagName === 'DETAILS') {
                if (traverse(children[i])) anyMatch = true;
              }
            }
            return anyMatch;
          }
          
          if (tree.firstChild) traverse(tree.firstChild);

          if (!query) {
            const selected = document.querySelector('summary.selected');
            if (selected) {
              selected.scrollIntoView({ block: 'center', behavior: 'smooth' });
            }
          }
        }

        function searchAllocs(query) {
           query = query.toLowerCase();
           document.querySelectorAll('#alloc-sidebar .alloc-item').forEach(item => {
              if (query === '') {
                  // @ts-ignore
                  item.style.display = 'block'; 
                  return; 
              }
              const text = item.textContent.toLowerCase();
              if (text.includes(query)) {
                  // @ts-ignore
                  item.style.display = 'block';
                  let parent = item.parentElement;
                  while (parent && parent.id !== 'alloc-sidebar') {
                      if (parent.tagName.toLowerCase() === 'details') {
                          // @ts-ignore
                          parent.open = true;
                      }
                      parent = parent.parentElement;
                  }
              } else {
                  // @ts-ignore
                  item.style.display = 'none';
              }
           });
        }

        function searchAllocAddress(query) {
           query = query.toLowerCase().replace('0x', '');
           document.querySelectorAll('#alloc-sidebar .alloc-item').forEach(item => {
              if (query === '') {
                  // @ts-ignore
                  item.style.display = 'block'; 
                  return; 
              }
              // @ts-ignore
              const addr = item.dataset.addr;
              if (addr && addr.includes(query)) {
                  // @ts-ignore
                  item.style.display = 'block';
                  let parent = item.parentElement;
                  while (parent && parent.id !== 'alloc-sidebar') {
                      if (parent.tagName.toLowerCase() === 'details') {
                          // @ts-ignore
                          parent.open = true;
                      }
                      parent = parent.parentElement;
                  }
              } else {
                  // @ts-ignore
                  item.style.display = 'none';
              }
           });
        }

        function resetZoom() {
          if (window.myChart) {
            window.myChart.options.scales.x.min = undefined;
            window.myChart.options.scales.x.max = undefined;
            window.myChart.resetZoom();
          }
        }

        function toggleMemoryMap() {
          const mainLayout = document.getElementById('mainLayout');
          const memLayout = document.getElementById('memoryMapLayout');
          const legend = document.getElementById('memory-map-legend');
          
          if (mainLayout.style.display === 'none') {
            mainLayout.style.display = 'flex';
            memLayout.style.display = 'none';
            if (legend) legend.style.display = 'none';
          } else {
            mainLayout.style.display = 'none';
            memLayout.style.display = 'block';
            if (legend) legend.style.display = 'flex';
            
            // @ts-ignore
            if (!window.memoryMapRendered) {
                const container = document.getElementById('memory-map-container');
                if (container) {
                    container.innerHTML = '<div style="display:flex; justify-content:center; align-items:center; height:100%;"><div class="flash-target" style="padding: 20px; background: #333; color: white; border-radius: 8px; font-size: 16px;">Computing Topological Memory Intersections...</div></div>';
                    setTimeout(() => {
                        container.innerHTML = '';
                        renderMemoryMap();
                        // @ts-ignore
                        window.memoryMapRendered = true;
                    }, 50);
                }
            }
          }
        }

        function updateEdgeLabels() {
            document.querySelectorAll('.map-scrollable').forEach(scrollable => {
                const inner = scrollable.querySelector('.map-inner');
                if (!inner) return;
                
                // Use scroll measurements directly resolving bounding offsets relative to zoomed capacities
                const ratioLeft = scrollable.scrollLeft / inner.scrollWidth;
                const ratioRight = (scrollable.scrollLeft + scrollable.clientWidth) / inner.scrollWidth;
                
                scrollable.querySelectorAll('.bank-row').forEach(bDiv => {
                    // @ts-ignore
                    const bankBase = parseInt(bDiv.dataset.base, 10);
                    // @ts-ignore
                    const bankSize = parseInt(bDiv.dataset.size, 10);
                    
                    const leftAddr = bankBase + (ratioLeft * bankSize);
                    const rightAddr = bankBase + (ratioRight * bankSize);
                    
                    // Match precisely structural 4K page bounds rounding explicitly evaluating absolute chunks!
                    const pageLeft = Math.floor(leftAddr / 4096) * 4096;
                    // Cap right bound conservatively at bankLimit - 1 equivalent
                    const pageRight = Math.min((Math.ceil(rightAddr / 4096) * 4096) - 1, bankBase + bankSize - 1);
                    
                    const startL = bDiv.querySelector('.start-label');
                    const endL = bDiv.querySelector('.end-label');
                    if (startL) {
                        startL.textContent = '0x' + Math.max(bankBase, pageLeft).toString(16).toUpperCase();
                        startL.style.left = (scrollable.scrollLeft + 2) + 'px';
                    }
                    if (endL) {
                        endL.textContent = '0x' + pageRight.toString(16).toUpperCase();
                        endL.style.left = (scrollable.scrollLeft + scrollable.clientWidth - endL.offsetWidth - 2) + 'px';
                    }
                });
            });
        }

        let mapZoom = 1.0;
        let redrawTimeout = null;
        let baseZoom = 1.0;
        let visualPanX = 0;
        let visualPanY = 0;
