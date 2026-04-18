const { getWebviewContent } = require('./out/webview');

const mockData = [];
for(let i=0; i<62565; i++) {
   mockData.push({
    t: 1000 + i,
    um: 1,
    ring: 3,
    intLevel: 0,
    iMiss: 0,
    dMiss: 0,
    callDepth: 1,
    excCause: null,
    c: 100,
    tlbType: null,
    tlbDetails: null,
    ioType: null,
    ioDevice: null,
    ioDetails: null,
    funcAddr: 0x1234,
    funcArgs: ['1', '2'],
    funcRet: undefined,
    funcName: 'test',
    file: '/home/test.c',
    line: 12
   });
}

console.log("Starting Webview HTML execution over 62,565 items...");
console.time("generateHTML");
try {
    const html = getWebviewContent(mockData);
    console.timeEnd("generateHTML");
    console.log("HTML OK length:", html.length);
} catch (e) {
    console.error("FAIL", e);
}
