import { describe, it, expect, spyOn } from 'bun:test';
import { printJson, printHuman, printError } from '../src/output';

describe('printJson', () => {
  it('logs compact JSON to stdout', () => {
    const spy = spyOn(console, 'log').mockImplementation(() => {});
    printJson({ foo: 'bar' });
    expect(spy).toHaveBeenCalledWith(JSON.stringify({ foo: 'bar' }));
    spy.mockRestore();
  });
});

describe('printHuman', () => {
  it('logs each line to stdout', () => {
    const spy = spyOn(console, 'log').mockImplementation(() => {});
    printHuman(['line one', 'line two']);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenNthCalledWith(1, 'line one');
    expect(spy).toHaveBeenNthCalledWith(2, 'line two');
    spy.mockRestore();
  });
});

describe('printError', () => {
  it('logs JSON error to stderr when json=true', () => {
    const spy = spyOn(console, 'error').mockImplementation(() => {});
    const exit = spyOn(process, 'exit').mockImplementation((() => {}) as any);
    printError('something broke', 1, true);
    expect(spy).toHaveBeenCalledWith(JSON.stringify({ error: 'something broke', code: 1 }));
    expect(exit).toHaveBeenCalledWith(1);
    spy.mockRestore();
    exit.mockRestore();
  });

  it('logs plain error to stderr when json=false', () => {
    const spy = spyOn(console, 'error').mockImplementation(() => {});
    const exit = spyOn(process, 'exit').mockImplementation((() => {}) as any);
    printError('something broke', 1, false);
    expect(spy).toHaveBeenCalledWith('Error: something broke');
    expect(exit).toHaveBeenCalledWith(1);
    spy.mockRestore();
    exit.mockRestore();
  });
});
