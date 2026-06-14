export const TestIDs = Object.freeze({
  home: {
    container: 'home.container',
    title: 'home.title',
    navElements: 'home.nav.elements',
    navKeyboard: 'home.nav.keyboard',
    navGestures: 'home.nav.gestures',
    navWebview: 'home.nav.webview',
    navPermissions: 'home.nav.permissions',
    navOrientation: 'home.nav.orientation',
  },
  elements: {
    container: 'elements.container',
    label: 'elements.label',
    input: 'elements.input',
    button: 'elements.button',
    buttonText: 'elements.button.text',
    counter: 'elements.counter',
  },
  kb: {
    container: 'kb.container',
    input: 'kb.input',
    echo: 'kb.echo',
  },
  gestures: {
    scroll: 'gestures.scroll',
    target: 'gestures.target',
    taps: 'gestures.taps',
    row: (n: number) => `gestures.row.${n}`,
    rowText: (n: number) => `gestures.row.${n}.text`,
  },
  webview: {
    container: 'webview.container',
    iframe: 'webview.iframe',
  },
} as const);
