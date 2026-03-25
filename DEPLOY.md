# Instrukcja wdrożenia (Node.js + PM2)

Aplikacja działa jako serwer Next.js standalone uruchamiany przez **PM2**.

---

## Pierwsze uruchomienie (nowy serwer)

### 1. Wymagania

```bash
# Node.js 20+
node -v

# PM2 globalnie
npm install -g pm2
```

### 2. Klonowanie repozytorium

```bash
git clone https://github.com/AbuzcKertoip/grafik.git
cd grafik
```

### 3. Plik `.env`

```bash
nano .env
```

Przykładowa zawartość:

```env
DATABASE_URL="file:./prisma/dev.db"
NEXTAUTH_SECRET="twoj-sekretny-klucz"
NEXTAUTH_URL="http://twoj-serwer-lub-domena"
```

### 4. Instalacja zależności i build

```bash
npm ci
npx prisma generate
npx prisma db push
npm run build
```

### 5. Uruchomienie przez PM2

```bash
pm2 start npm --name "grafik" -- start
pm2 save
pm2 startup   # opcjonalnie: autostart po restarcie serwera
```

---

## Aktualizacja aplikacji

Po wypchnięciu zmian do GitHuba uruchom na serwerze:

```bash
git pull

# Jeśli zmieniło się schema bazy danych:
npx prisma db push

# Jeśli zmieniły się zależności:
npm ci

# Przebuduj i zrestartuj
npm run build
pm2 restart grafik
```

---

## Użyteczne komendy PM2

```bash
pm2 status            # status procesów
pm2 logs grafik       # logi na żywo
pm2 logs grafik --lines 100  # ostatnie 100 linii logów
pm2 restart grafik    # restart
pm2 stop grafik       # zatrzymanie
```

---

## Backup bazy danych

```bash
cp prisma/dev.db ~/backup_grafik_$(date +%F).db
```
