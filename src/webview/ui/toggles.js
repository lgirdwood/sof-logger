        function toggleExceptions() {
          showExceptions = !showExceptions;
          document.getElementById('toggleExceptionsBtn').innerText = 'Toggle Exceptions (' + (showExceptions ? 'On' : 'Off') + ')';
          window.myChart.update();
        }

        function toggleTlb() {
          showTlb = !showTlb;
          document.getElementById('toggleTlbBtn').innerText = 'Toggle TLB Events (' + (showTlb ? 'On' : 'Off') + ')';
          window.myChart.update();
        }

        function toggleIo() {
          showIo = !showIo;
          document.getElementById('toggleIoBtn').innerText = 'Toggle ACE IO (' + (showIo ? 'On' : 'Off') + ')';
          window.myChart.update();
        }
