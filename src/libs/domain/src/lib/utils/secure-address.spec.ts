import { isInsecureContext, openOverHttpsAdvice } from './secure-address';

describe('openOverHttpsAdvice', () => {
  it('names the page host with the secure port', () => {
    expect(openOverHttpsAdvice(10214, '192.168.1.220')).toBe(
      'Open this page over https at https://192.168.1.220:10214.'
    );
  });

  it('points at the secure address that trom ui lists when the port is unknown', () => {
    expect(openOverHttpsAdvice(null, '192.168.1.220')).toBe(
      'Open this page over https at the secure address that trom ui lists.'
    );
  });
});

describe('isInsecureContext', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'isSecureContext');

  afterEach(() => {
    if (original) {
      Object.defineProperty(globalThis, 'isSecureContext', original);
    } else {
      delete (globalThis as unknown as Record<string, unknown>)['isSecureContext'];
    }
  });

  it.each([
    [false, true],
    [true, false],
    [undefined, false],
  ])('with isSecureContext %s reports %s', (flag, expected) => {
    Object.defineProperty(globalThis, 'isSecureContext', { value: flag, configurable: true });
    expect(isInsecureContext()).toBe(expected);
  });
});
