<div align="center">
  <h1>🏢 HR4YOU - System Zarządzania Zasobami Ludzkimi i Czasem Pracy</h1>
  <p>
    <strong>Kompleksowa platforma do ewidencji czasu pracy, zarządzania pracownikami, flotą oraz urlopami.</strong>
  </p>
</div>

---

## 📖 O projekcie

HR4YOU (wewnętrzenie znany jako *Grafik*) to nowoczesna, w pełni responsywna aplikacja webowa typu B2B ułatwiająca zarządzenie kluczowymi procesami HR i operacyjnymi w firmie. System został stworzony z myślą o skalowalności i automatyzacji żmudnych procesów administracyjnych, eliminując obieg dokumentów papierowych (np. karty pracy).

Główne założenie systemu: **Zebrać całą istotną wiedzę o załodze, grafikach i przypisanym sprzęcie w jednym, bezpiecznym miejscu.**

---

## ✨ Główne moduły i funkcjonalności

### 👥 1. Zarządzanie Zasobami Ludzkimi (Dział HR)
*   **Katalog pracowników:** Pełne profile pracowników, struktura organizacyjna z podziałem na działy.
*   **Zarządzanie badaniami lekarskimi:** Ewidencja dat ważności badań medycznych z automatycznymi powiadomieniami dla pracowników i menedżerów o zbliżającym się terminie odnowienia (ikony alertów oraz e-maile).
*   **Uprawnienia (RBAC):** Bardzo precyzyjny podział ról w systemie (`ADMIN`, `SZEF` - tylko do odczytu, `HR`, `MANAGER`, `USER`), w tym obsługa "drugiego działu" (np. gdy kierownik nadzoruje jednocześnie dwa niezależne departamenty).

### 📅 2. Ewidencja Czasu Pracy (Grafik)
*   **Interaktywny kalendarz:** Wygodne widoki harmonogramów przypisanych zmian (Zmiana 1, Zmiana 2, itd.) i dni wolnych dla każdego działu.
*   **Wniosek urlopowy:** Elektroniczny system składania wniosków urlopowych (w tym urlop na żądanie, okolicznościowy). Synchronizacja akceptacji przez menedżerów z automatyczną zmianą statusu na e-grafiku.
*   **Automatyzacja mailowa:** Kierownicy natychmiast otrzymują wiadomości e-mail, gdy ich podwładni poproszą o wolne, a pracownicy – gdy wniosek zostaje przeprocesowany.

### 📊 3. Karty Pracy (Work Logs)
*   **Generowanie raportów:** Możliwość uzupełnienia dokładnego przepracowanego czasu i wysłania miesięcznej "Karty Pracy" z poziomu aplikacji.
*   **Generacja Excel/PDF:** System w kilka sekund potrafi automatycznie skompilować pliki `.xlsx` i dostarczyć je do wglądu kierownika oraz do działu kadr, co drastycznie ucina papierologię.

### 🚗 4. Zarządzanie Flotą (Ewidencja Pojazdów)
*   **Przypisania aut:** Śledzenie samochodów służbowych, tablic rejestracyjnych i ich aktualnych "opiekunów".
*   **Terminy:** Kontrola nad terminami ważności ubezpieczeń (OC/AC) oraz przeglądów technicznych wraz z systemem powiadomień.

### ⚙️ 5. Powiadomienia Sieciowe i Logi
*   **Powiadomienia E-mail:** Automatyczne zadania w tle (CRON Jobs) np. przypomnienia o ubezpieczeniach czy gasnących badaniach lekarskich wysyłane pocztą elektroniczną.
*   **Logi Systemowe (Mail History):** Moduł dla administratorów śledzący statystyki wysłanych przez system wiadomości e-mail w celach archiwizacyjnych z możliwością manualnego wyklikania "Force Check".

---

## 🛠 Technologie i Architektura

Aplikacja została zbudowana wykorzystując supernowoczesny, wydajny stack dla aplikacji typu Enterprise:

*   **Język i Framework:** TypeScript, [Next.js](https://nextjs.org/) (React z użyciem najnowszego App Routera, Server Actions API).
*   **Zarządzanie bazą danych:** [Prisma ORM](https://www.prisma.io/). Gwarantuje nam mocne typowanie schematów (database schema) od góry do dołu.
*   **Baza Danych:** SQLite (dla trybów deweloperskich/lekkiego środowiska wdrożeniowego) z natychmiastową możliwością przestawienia na środowisko klastrowe (Postgres/MySQL).
*   **Autoryzacja i Sesje:** [NextAuth.js](https://next-auth.js.org/) - implementacja zabezpieczeń, sesji opartej o JWT i szyfrowanie haseł (bcryptjs).
*   **Wygląd i UI:**
    *   [Tailwind CSS](https://tailwindcss.com/) - utility-first framework do stylowania.
    *   [shadcn/ui](https://ui.shadcn.com/) / Radix UI – wysoko dostępne, niesamowicie płynne komponenty dla budowania interfejsu klas premium.
    *   [Lucide React](https://lucide.dev/) - responsywne paczki ikon systemowych.
*   **Narzędzia Poboczne:**
    *   `xlsx` - do obsługi eksportu zestawień i arkuszy kalkulacyjnych.
    *   `date-fns` - dla niezawodnych manipulacji strefami czasowymi i datami w grafiku.
    *   `nodemailer` / zewnętrzny serwer SMTP - wbudowany mikroserwis wysyłek powiadomień.

---

## 🚀 Jak uruchomić projekt (Developer)

1. **Sklonuj Repozytorium**
   ```bash
   git clone https://github.com/AbuzcKertoip/grafik.git
   cd grafik
   ```

2. **Zainstaluj Pakiety**
   ```bash
   npm install
   ```

3. **Ustaw plik środowski**
   Utwórz plik `.env` w głównym katalogu na podstawie zmiennych projektu:
   ```env
   DATABASE_URL="file:./dev.db"
   NEXTAUTH_SECRET="twoj_unikalny_super_tajny_klucz"
   NEXTAUTH_URL="http://localhost:3000"
   ```

4. **Wykonaj Migracje Bazy Danych (Prisma)**
   Ta komenda zsynchronizuje strukturę i stworzy nową bazę danych lokalnie.
   ```bash
   npx prisma generate
   npx prisma db push
   ```
   *(Opcjonalnie: Zaaplikuj skrypt `seed.js`/`seed.ts`, jeśli masz przygotowanego domyślnego użytkownika "admin")*

5. **Odpal Środowisko Rozwojowe**
   ```bash
   npm run dev
   ```
   Aplikacja będzie w pełni dostępna pod adresem: [http://localhost:3000](http://localhost:3000)

---

## 🛡️ Bezpieczeństwo i Architektura Uprawnień (RBAC)
Zadbano o drastyczną hermetyzację uprawnień. Większość logiki weryfikowanej jest w trybie "Server-Side" poprzez `Server Actions` i weryfikację tokenu. 
Nawet modyfikacja kodu "wizualnego" na stronie front-endowej (React) nie jest w stanie pominąć restrykcyjnych uwarunkowań narzuconych na endpointach Prisma Client!

Szczególne instrukcje obronne:
* Ochrona autoryzacji "Middleware proxy" od NextJS na podstrony `/dashboard/*`.
* Brak możliwości samodzielnego usunięcia konta przez aktywnego Admina, co zapobiega zablokowaniu panelu (soft-lock).
* Dynamiczna izolacja (np. Menedżer widzi jedynie logi pracy i badania pracownika połączonego silnikiem relacyjnym ze swoją strukturą organizacyjną).

---

> Projekt przygotowany w ramach ścisłych celów B2B. Gotowy do pierwszej aktywnej fazy **BETA-TESTÓW**. 🚀
