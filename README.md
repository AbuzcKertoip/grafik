# System Zarządzania Grafikami (Grafik)

Nowoczesna aplikacja webowa do zarządzania czasem pracy, grafikami i urlopami, stworzona przy użyciu [Next.js](https://nextjs.org), [Prisma](https://www.prisma.io) i [Tailwind CSS](https://tailwindcss.com).

## Funkcjonalności

- **Zarządzanie grafikami:** Planowanie zmian pracowniczych, blokady zmian, generowanie grafików.
- **Ewidencja czasu pracy:** Rejestracja obecności, nadgodzin i wniosków urlopowych.
- **Panel Pracownika:** Podgląd grafiku, statusu urlopów i statystyk.
- **Panel Administratora:** Całościowe zarządzanie systemem, użytkownikami i ustawieniami.
- **Płatności:** System rozliczania wynagrodzeń oparty na stawkach godzinowych i dodatkach.

## Wymagania

- **Node.js**: 18.x lub nowszy (zalecane)
- **Baza danych**: SQLite (domyślnie, dev.db)
- **Docker & Docker Compose**: Opcjonalnie, do łatwego uruchomienia w kontenerze.

## Instalacja i Uruchomienie

### Opcja 1: Lokalnie (Node.js)

1.  **Sklonuj repozytorium:**

    ```bash
    git clone https://github.com/twoj-uzytkownik/grafik.git
    cd grafik
    ```

2.  **Zainstaluj zależności:**

    ```bash
    npm install
    # lub
    yarn install
    ```

3.  **Skonfiguruj środowisko:**

    Utwórz plik `.env` w katalogu głównym projektu i uzupełnij go (przykład zmiennych znajdziesz w dokumentacji lub zapytaj administratora).
    ```env
    DATABASE_URL="file:./dev.db"
    NEXTAUTH_SECRET="twoj-sekretny-klucz"
    NEXTAUTH_URL="http://localhost:3000"
    ```

4.  **Przygotuj bazę danych:**

    ```bash
    npx prisma generate
    npx prisma db push
    ```

5.  **Uruchom serwer deweloperski:**

    ```bash
    npm run dev
    ```

    Aplikacja będzie dostępna pod adresem [http://localhost:3000](http://localhost:3000).

### Opcja 2: Kontener Docker (Zalecane)

Dzięki Dockerowi możesz uruchomić aplikację bez konieczności instalowania Node.js lokalnie.

1.  **Wymagania:** Upewnij się, że masz zainstalowanego Dockera i Docker Compose.

2.  **Konfiguracja:** Skopiuj `.env` (lub stwórz nowy) w katalogu głównym projektu.

3.  **Uruchomienie:**

    W terminalu wpisz:
    ```bash
    docker compose up -d --build
    ```

    Poczekaj chwilę, aż kontenery się zbudują i uruchomią. Aplikacja będzie dostępna pod adresem [http://localhost:3000](http://localhost:3000).

    Aby zatrzymać aplikację:
    ```bash
    docker compose down
    ```

## Wdrożenie na serwer (Debian)

Szczegółowa instrukcja wdrożenia „krok po kroku” dla systemu **Debian 12 (Bookworm)** znajduje się w pliku [DEPLOY.md](./DEPLOY.md).

## Technologie

- **Frontend/Backend:** Next.js 14+ (App Router)
- **Baza danych:** SQLite + Prisma ORM
- **Stylizacja:** Tailwind CSS, Shadcn UI
- **Uwierzytelnianie:** NextAuth.js
- **Ikony:** Lucide React

## Autor

Projekt prywatny (Piotr Czuba). Wszelkie prawa zastrzeżone.
