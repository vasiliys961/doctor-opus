import { describe, expect, it } from 'vitest';
import { anonymizeText } from './anonymization';

describe('anonymizeText', () => {
  it('masks English full names', () => {
    const source = 'Patient John Smith reports chest pain.';
    const result = anonymizeText(source);

    expect(result).toContain('[NAME]');
    expect(result).not.toContain('John Smith');
  });

  it('masks names with initials for medical staff', () => {
    const source = 'Doctor: Ivanov I.I.; Nurse: KUNIKINA D.V.; Driver: Иванян А.П.';
    const result = anonymizeText(source);

    expect(result).toContain('Doctor: [NAME]');
    expect(result).toContain('Nurse: [NAME]');
    expect(result).toContain('Driver: [NAME]');
    expect(result).not.toContain('Ivanov I.I.');
    expect(result).not.toContain('KUNIKINA D.V.');
    expect(result).not.toContain('Иванян А.П.');
  });

  it('masks phone and email', () => {
    const source = 'Phone: +7 (999) 123-45-67, Email: john.smith@example.com';
    const result = anonymizeText(source);

    expect(result).toContain('[ТЕЛЕФОН]');
    expect(result).toContain('[EMAIL]');
    expect(result).not.toContain('+7 (999) 123-45-67');
    expect(result).not.toContain('john.smith@example.com');
  });
});

