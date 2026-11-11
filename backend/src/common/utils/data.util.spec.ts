import {
  diferencaEmDias,
  ehDataIso,
  hojeIso,
  paraIso,
  somarDias,
} from './data.util.js';

describe('datas', () => {
  it('usa o dia da escola (UTC-3), e não o dia do servidor em UTC', () => {
    // 01:30 UTC do dia 12 ainda é 22:30 do dia 11 em Macapá.
    const momento = new Date('2026-11-12T01:30:00.000Z');
    expect(paraIso(momento, 'America/Belem')).toBe('2026-11-11');
    expect(paraIso(momento, 'UTC')).toBe('2026-11-12');
    expect(hojeIso(momento)).toBe('2026-11-11');
  });

  it('soma e subtrai dias atravessando mês e ano', () => {
    expect(somarDias('2026-10-30', 3)).toBe('2026-11-02');
    expect(somarDias('2027-01-01', -1)).toBe('2026-12-31');
    expect(somarDias('2028-02-28', 1)).toBe('2028-02-29'); // bissexto
  });

  it('calcula a diferença em dias', () => {
    expect(diferencaEmDias('2026-11-11', '2026-11-18')).toBe(7);
    expect(diferencaEmDias('2026-11-18', '2026-11-11')).toBe(-7);
    expect(diferencaEmDias('2026-11-11', '2026-11-11')).toBe(0);
  });

  it('valida o formato AAAA-MM-DD e datas que não existem', () => {
    expect(ehDataIso('2026-11-11')).toBe(true);
    expect(ehDataIso('11/11/2026')).toBe(false);
    expect(ehDataIso('2026-02-30')).toBe(false);
    expect(ehDataIso('2026-11-11T10:00:00.000Z')).toBe(false);
    expect(ehDataIso(20261111)).toBe(false);
  });
});
