import { describe, it, expect, spyOn } from 'bun:test';
import { printJson, printHuman, printError, stateDisplay, errorMessage } from '../src/output';

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
    expect(spy.mock.calls[0][0]).toContain('Error:');
    expect(spy.mock.calls[0][0]).toContain('something broke');
    expect(exit).toHaveBeenCalledWith(1);
    spy.mockRestore();
    exit.mockRestore();
  });
});

describe('stateDisplay', () => {
  const knownStates = [
    'QUEUED',
    'AWAITING_PLAN_APPROVAL',
    'AWAITING_USER_FEEDBACK',
    'IN_PROGRESS',
    'PAUSED',
    'COMPLETED',
    'FAILED',
  ];

  for (const state of knownStates) {
    it(`returns the state name for ${state}`, () => {
      expect(stateDisplay(state)).toContain(state);
    });
  }

  it('passes an unknown state through', () => {
    expect(stateDisplay('SOMETHING_ELSE')).toContain('SOMETHING_ELSE');
  });
});

describe('errorMessage', () => {
  it('returns error.message for an Error', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom');
  });

  it('returns String(x) for anything else', () => {
    expect(errorMessage('plain')).toBe('plain');
    expect(errorMessage(42)).toBe('42');
    expect(errorMessage(null)).toBe('null');
    expect(errorMessage(undefined)).toBe('undefined');
  });
});
