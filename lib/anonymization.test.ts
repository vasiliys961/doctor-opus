import { describe, expect, it } from 'vitest';
import { anonymizeText } from './anonymization';

describe('anonymizeText', () => {
  it('masks Russian full name in plain text', () => {
    const source = 'Иванов Иван Иванович поступил с жалобами.';
    const result = anonymizeText(source);

    expect(result).toContain('[ФИО]');
    expect(result).not.toContain('Иванов Иван Иванович');
  });

  it('masks English name in plain text', () => {
    const source = 'Patient John Smith reports chest pain.';
    const result = anonymizeText(source);

    expect(result).toContain('[NAME]');
    expect(result).not.toContain('John Smith');
  });

  it('masks labeled DOB and address fields', () => {
    const source = 'DOB: 1990-05-20; Address: 10 Baker Street, London';
    const result = anonymizeText(source);

    expect(result).toContain('DOB: [ДАТА]');
    expect(result).toContain('Address: [АДРЕС]');
    expect(result).not.toContain('1990-05-20');
    expect(result).not.toContain('10 Baker Street');
  });

  it('masks phone and email', () => {
    const source = 'Phone: +7 (999) 123-45-67, Email: john.smith@example.com';
    const result = anonymizeText(source);

    expect(result).toContain('Phone: [ТЕЛЕФОН]');
    expect(result).toContain('Email: [EMAIL]');
    expect(result).not.toContain('+7 (999) 123-45-67');
    expect(result).not.toContain('john.smith@example.com');
  });

  it('masks passport and SNILS', () => {
    const source = 'Паспорт: 4509 123456, СНИЛС: 123-456-789 12';
    const result = anonymizeText(source);

    expect(result).toContain('Паспорт: [ПАСПОРТ]');
    expect(result).toContain('СНИЛС: [СНИЛС]');
    expect(result).not.toContain('4509 123456');
    expect(result).not.toContain('123-456-789 12');
  });
});
