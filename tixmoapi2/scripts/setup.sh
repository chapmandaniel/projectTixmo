#!/bin/bash

# TixMo API Setup Script

echo "🎫 TixMo API - Initial Setup"
echo "=============================="
echo ""

# Check Node.js version
echo "Checking Node.js version..."
node_version=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$node_version" -lt 18 ]; then
    echo "❌ Error: Node.js 18 or higher is required"
    exit 1
fi
echo "✅ Node.js version OK"
echo ""

# Check if Docker is running (for database)
echo "Checking Docker..."
if ! docker info > /dev/null 2>&1; then
    echo "⚠️  Warning: Docker is not running"
    echo "   You'll need Docker to run PostgreSQL and Redis"
    echo "   Start Docker Desktop and run this script again"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo "✅ Docker is running"
fi
echo ""

# Install dependencies
echo "Installing npm dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi
echo "✅ Dependencies installed"
echo ""

# Set up environment file
if [ ! -f .env ]; then
    echo "Creating .env file from template..."
    cp .env.example .env
    echo "✅ .env file created"
    echo "⚠️  Remember to update .env with your actual credentials"
else
    echo "⚠️  .env file already exists, skipping..."
fi
echo ""

# Start Docker services
if docker info > /dev/null 2>&1; then
    echo "Starting Docker services (PostgreSQL & Redis)..."
    docker-compose up -d
    if [ $? -ne 0 ]; then
        echo "❌ Failed to start Docker services"
        exit 1
    fi
    echo "✅ Docker services started"
    echo ""

    # Wait for PostgreSQL to be ready
    echo "Waiting for PostgreSQL to be ready..."
    sleep 5
    echo "✅ PostgreSQL should be ready"
    echo ""
fi

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate
if [ $? -ne 0 ]; then
    echo "❌ Failed to generate Prisma client"
    exit 1
fi
echo "✅ Prisma client generated"
echo ""

# Run database migrations
if docker info > /dev/null 2>&1; then
    echo "Running database migrations..."
    npx prisma migrate dev --name init
    if [ $? -ne 0 ]; then
        echo "⚠️  Database migration had issues (this is normal on first run)"
    else
        echo "✅ Database migrations complete"
    fi
    echo ""
fi

# Create logs directory
echo "Creating logs directory..."
mkdir -p logs
echo "✅ Logs directory created"
echo ""

# Initialize git repository
if [ ! -d .git ]; then
    echo "Initializing Git repository..."
    git init
    git add .
    git commit -m "Initial project setup"
    echo "✅ Git repository initialized"
else
    echo "✅ Git repository already exists"
fi
echo ""

echo "=============================="
echo "🎉 Setup Complete!"
echo "=============================="
echo ""
echo "Next steps:"
echo "1. Update .env with your actual credentials"
echo "2. Run 'npm run dev' to start the development server"
echo "3. Visit http://localhost:3000/health to verify"
echo "4. Check out NEXT_STEPS.md for what to build next"
echo ""
echo "Useful commands:"
echo "  npm run dev          - Start development server"
echo "  npm test             - Run tests"
echo "  npm run lint         - Check code quality"
echo "  docker-compose up -d - Start databases"
echo "  docker-compose down  - Stop databases"
echo ""
// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserRole {
  ADMIN
  PROMOTER
  CUSTOMER
  SCANNER
}

enum OrganizationType {
  PROMOTER
  VENUE
  RESELLER
}

enum OrganizationStatus {
  ACTIVE
  SUSPENDED
  PENDING
}

model User {
  id                String        @id @default(uuid())
  email             String        @unique
  passwordHash      String        @map("password_hash")
  firstName         String        @map("first_name")
  lastName          String        @map("last_name")
  phone             String?
  role              UserRole      @default(CUSTOMER)
  organizationId    String?       @map("organization_id")
  organization      Organization? @relation(fields: [organizationId], references: [id])
  emailVerified     Boolean       @default(false) @map("email_verified")
  twoFactorEnabled  Boolean       @default(false) @map("two_factor_enabled")
  twoFactorSecret   String?       @map("two_factor_secret")
  lastLogin         DateTime?     @map("last_login")
  createdAt         DateTime      @default(now()) @map("created_at")
  updatedAt         DateTime      @updatedAt @map("updated_at")

  // Relations
  orders            Order[]
  tickets           Ticket[]

  @@map("users")
}

model Organization {
  id               String              @id @default(uuid())
  name             String
  slug             String              @unique
  type             OrganizationType
  stripeAccountId  String?             @map("stripe_account_id")
  status           OrganizationStatus  @default(PENDING)
  settings         Json?
  createdAt        DateTime            @default(now()) @map("created_at")
  updatedAt        DateTime            @updatedAt @map("updated_at")

  // Relations
  users            User[]
  events           Event[]
  venues           Venue[]
  promoCodes       PromoCode[]

  @@map("organizations")
}

model Venue {
  id               String       @id @default(uuid())
  organizationId   String       @map("organization_id")
  organization     Organization @relation(fields: [organizationId], references: [id])
  name             String
  address          Json
  capacity         Int
  seatingChart     Json?        @map("seating_chart")
  timezone         String
  metadata         Json?
  createdAt        DateTime     @default(now()) @map("created_at")
  updatedAt        DateTime     @updatedAt @map("updated_at")

  // Relations
  events           Event[]

  @@map("venues")
}

enum EventStatus {
  DRAFT
  PUBLISHED
  ON_SALE
  SOLD_OUT
  CANCELLED
  COMPLETED
}

model Event {
  id               String       @id @default(uuid())
  organizationId   String       @map("organization_id")
  organization     Organization @relation(fields: [organizationId], references: [id])
  venueId          String       @map("venue_id")
  venue            Venue        @relation(fields: [venueId], references: [id])
  name             String
  slug             String       @unique
  description      String?      @db.Text
  category         String
  tags             String[]
  startDatetime    DateTime     @map("start_datetime")
  endDatetime      DateTime     @map("end_datetime")
  timezone         String
  status           EventStatus  @default(DRAFT)
  images           Json?
  metadata         Json?
  salesStart       DateTime?    @map("sales_start")
  salesEnd         DateTime?    @map("sales_end")
  capacity         Int
  minTicketPrice   Decimal?     @map("min_ticket_price") @db.Decimal(10, 2)
  maxTicketPrice   Decimal?     @map("max_ticket_price") @db.Decimal(10, 2)
  createdAt        DateTime     @default(now()) @map("created_at")
  updatedAt        DateTime     @updatedAt @map("updated_at")

  // Relations
  ticketTypes      TicketType[]
  orders           Order[]
  tickets          Ticket[]

  @@map("events")
}

enum TicketTypeStatus {
  ACTIVE
  SOLD_OUT
  HIDDEN
}

model TicketType {
  id                    String            @id @default(uuid())
  eventId               String            @map("event_id")
  event                 Event             @relation(fields: [eventId], references: [id])
  name                  String
  description           String?           @db.Text
  price                 Decimal           @db.Decimal(10, 2)
  quantityTotal         Int               @map("quantity_total")
  quantityAvailable     Int               @map("quantity_available")
  quantitySold          Int               @default(0) @map("quantity_sold")
  quantityHeld          Int               @default(0) @map("quantity_held")
  salesStart            DateTime?         @map("sales_start")
  salesEnd              DateTime?         @map("sales_end")
  maxPerOrder           Int               @default(10) @map("max_per_order")
  requiresSeatSelection Boolean           @default(false) @map("requires_seat_selection")
  metadata              Json?
  status                TicketTypeStatus  @default(ACTIVE)
  createdAt             DateTime          @default(now()) @map("created_at")
  updatedAt             DateTime          @updatedAt @map("updated_at")

  // Relations
  tickets               Ticket[]

  @@map("ticket_types")
}

enum OrderStatus {
  PENDING
  PAID
  CANCELLED
  REFUNDED
  PARTIALLY_REFUNDED
}

enum PaymentStatus {
  PENDING
  PROCESSING
  SUCCEEDED
  FAILED
}

model Order {
  id                String         @id @default(uuid())
  orderNumber       String         @unique @map("order_number")
  userId            String         @map("user_id")
  user              User           @relation(fields: [userId], references: [id])
  eventId           String         @map("event_id")
  event             Event          @relation(fields: [eventId], references: [id])
  status            OrderStatus    @default(PENDING)
  totalAmount       Decimal        @map("total_amount") @db.Decimal(10, 2)
  feesAmount        Decimal        @default(0) @map("fees_amount") @db.Decimal(10, 2)
  taxAmount         Decimal        @default(0) @map("tax_amount") @db.Decimal(10, 2)
  discountAmount    Decimal        @default(0) @map("discount_amount") @db.Decimal(10, 2)
  paymentStatus     PaymentStatus  @default(PENDING) @map("payment_status")
  paymentIntentId   String?        @map("payment_intent_id")
  paymentMethod     String?        @map("payment_method")
  promoCodeId       String?        @map("promo_code_id")
  promoCode         PromoCode?     @relation(fields: [promoCodeId], references: [id])
  ipAddress         String?        @map("ip_address")
  userAgent         String?        @map("user_agent") @db.Text
  expiresAt         DateTime?      @map("expires_at")
  createdAt         DateTime       @default(now()) @map("created_at")
  updatedAt         DateTime       @updatedAt @map("updated_at")

  // Relations
  tickets           Ticket[]

  @@map("orders")
}

enum TicketStatus {
  VALID
  USED
  CANCELLED
  TRANSFERRED
}

model Ticket {
  id              String        @id @default(uuid())
  orderId         String        @map("order_id")
  order           Order         @relation(fields: [orderId], references: [id])
  eventId         String        @map("event_id")
  event           Event         @relation(fields: [eventId], references: [id])
  ticketTypeId    String        @map("ticket_type_id")
  ticketType      TicketType    @relation(fields: [ticketTypeId], references: [id])
  userId          String        @map("user_id")
  user            User          @relation(fields: [userId], references: [id])
  barcode         String        @unique
  qrCodeUrl       String?       @map("qr_code_url")
  seatInfo        Json?         @map("seat_info")
  status          TicketStatus  @default(VALID)
  pricePaid       Decimal       @map("price_paid") @db.Decimal(10, 2)
  checkedInAt     DateTime?     @map("checked_in_at")
  checkedInBy     String?       @map("checked_in_by")
  transferredFrom String?       @map("transferred_from")
  transferredAt   DateTime?     @map("transferred_at")
  createdAt       DateTime      @default(now()) @map("created_at")
  updatedAt       DateTime      @updatedAt @map("updated_at")

  @@map("tickets")
}

enum DiscountType {
  PERCENTAGE
  FIXED_AMOUNT
}

enum PromoCodeStatus {
  ACTIVE
  EXPIRED
  DISABLED
}

model PromoCode {
  id                String           @id @default(uuid())
  organizationId    String           @map("organization_id")
  organization      Organization     @relation(fields: [organizationId], references: [id])
  code              String           @unique
  description       String?          @db.Text
  discountType      DiscountType     @map("discount_type")
  discountValue     Decimal          @map("discount_value") @db.Decimal(10, 2)
  maxUses           Int?             @map("max_uses")
  usesCount         Int              @default(0) @map("uses_count")
  validFrom         DateTime         @map("valid_from")
  validUntil        DateTime         @map("valid_until")
  applicableEvents  String[]         @map("applicable_events")
  minOrderValue     Decimal?         @map("min_order_value") @db.Decimal(10, 2)
  status            PromoCodeStatus  @default(ACTIVE)
  createdAt         DateTime         @default(now()) @map("created_at")
  updatedAt         DateTime         @updatedAt @map("updated_at")

  // Relations
  orders            Order[]

  @@map("promo_codes")
}

