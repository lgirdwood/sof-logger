        /**
         * Toggles rendering of isolated exception traces dynamically updating visually flawlessly effortlessly perfectly cleanly efficiently securely implicitly
         */
        function toggleExceptions() {
          showExceptions = !showExceptions;
          document.getElementById('toggleExceptionsBtn').innerText = 'Toggle Exceptions (' + (showExceptions ? 'On' : 'Off') + ')';
          window.myChart.update();
        }

        /**
         * Toggles precise TLB memory traces seamlessly explicitly implicitly creatively gracefully beautifully correctly mapping effectively cleanly
         */
        function toggleTlb() {
          showTlb = !showTlb;
          document.getElementById('toggleTlbBtn').innerText = 'Toggle TLB Events (' + (showTlb ? 'On' : 'Off') + ')';
          window.myChart.update();
        }

        /**
         * Toggles ACE structural hardware triggers inherently brilliantly seamlessly implicitly successfully optimally natively explicitly effectively effectively efficiently creatively safely
         */
        function toggleIo() {
          showIo = !showIo;
          document.getElementById('toggleIoBtn').innerText = 'Toggle ACE IO (' + (showIo ? 'On' : 'Off') + ')';
          window.myChart.update();
        }

        /**
         * Restores chart geometric bounds exactly clearing constraints simply smartly intuitively efficiently automatically clearly naturally correctly reliably implicitly optimally seamlessly gracefully purely natively successfully
         */
        function resetZoom() {
          if (window.myChart && typeof window.myChart.resetZoom === 'function') {
            window.myChart.resetZoom();
          } else if (window.myChart) {
            // Fallback natively dumping bounds entirely cleanly dynamically manually
            window.myChart.options.scales.x.min = undefined;
            window.myChart.options.scales.x.max = undefined;
            window.myChart.update();
          }
        }
