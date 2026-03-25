export const GITHUB_DOCS_BASE_URL = "https://github.com/P107R/grafik/wiki/Error-Codes";

export const ERROR_CODES = {
    // Auth & User Events
    AUTH_LOGIN_SUCCESS: { code: "AUTH-001", label: "Pomyślne Logowanie", isError: false },
    AUTH_LOGIN_FAILED: { code: "ERR-AUTH-002", label: "Błąd Logowania", isError: true },
    USER_CREATED: { code: "USR-001", label: "Utworzenie Użytkownika", isError: false },
    USER_UPDATED: { code: "USR-002", label: "Aktualizacja Użytkownika", isError: false },
    USER_ROLE_CHANGED: { code: "USR-003", label: "Zmiana Roli Użytkownika", isError: false },
    USER_DELETED: { code: "USR-004", label: "Usunięcie Użytkownika", isError: false },

    // Schedule Events
    SCHEDULE_MODIFIED: { code: "SCH-001", label: "Modyfikacja Grafiku", isError: false },
    SHIFT_ADDED: { code: "SCH-002", label: "Dodanie Zmiany", isError: false },
    SHIFT_REMOVED: { code: "SCH-003", label: "Usunięcie Zmiany", isError: false },

    // HR Events
    CONTRACT_ADDED: { code: "HR-001", label: "Dodanie Umowy", isError: false },
    PAYROLL_MODIFIED: { code: "HR-002", label: "Modyfikacja Płac", isError: false },
    VACATION_REQUESTED: { code: "HR-003", label: "Wniosek Urlopowy", isError: false },
    VACATION_APPROVED: { code: "HR-004", label: "Zatwierdzenie Urlopu", isError: false },
    VACATION_REJECTED: { code: "HR-005", label: "Odrzucenie Urlopu", isError: false },

    // System Events
    SETTINGS_UPDATED: { code: "SYS-001", label: "Zmiana Ustawień", isError: false },
    MANUAL_ALERT_TRIGGERED: { code: "SYS-002", label: "Ręczny Alert Systemowy", isError: false },
    CRON_ALERT_TRIGGERED: { code: "SYS-003", label: "Automatyczny Alert Systemowy", isError: false },
    EMAIL_SEND_FAILED: { code: "ERR-SYS-004", label: "Błąd Wysyłania Email", isError: true },

    // Generic
    UNKNOWN_ERROR: { code: "ERR-999", label: "Nieznany Błąd", isError: true },
} as const;

export type ErrorCodeKey = keyof typeof ERROR_CODES;

export function getCodeDefinition(key: ErrorCodeKey) {
    return ERROR_CODES[key];
}

export function getDocsUrl(code: string) {
    return `${GITHUB_DOCS_BASE_URL}#${code.toLowerCase()}`;
}
