# ⚓ AnchorTrack: Master Order & Payment Tracking Cloud Application
## Coastal Quick-Service Restaurant (QSR) Platform for Anchor Cafe
### Location: Ramapuram Beach, Chirala (Choramandal Coast)

![Anchor Cafe Hero](/public/assets/images/anchor_cafe_hero.jpg)

---

## 🌊 Executive Overview

**AnchorTrack** is an enterprise-grade Order, Kitchen Order Ticket (KOT), and Payment Tracking Cloud Platform engineered specifically for **Anchor Cafe**, situated directly on the golden sands of **Ramapuram Beach, Chirala**. 

Due to high tourist influxes (especially travelers arriving from Hyderabad, Guntur, and Vijayawada on weekends), AnchorTrack provides instantaneous real-time coordination between:
- 🏖️ **Beachfront Loungers & Waterline Service**
- 🪵 **Open-Air Wooden Deck Dining Tables**
- 🛍️ **Counter Takeaway & Express Stand**
- 🍳 **Kitchen & Beverage Bar Stations**
- 💳 **Multi-Channel Payment Reconciliation (Cash, Dynamic UPI QR, POS Card)**

---

## 🚀 Key Architectural Features

1. **Psychological Charm Pricing Engine (.99 & 9-Ending Rules)**:
   - **Strict Exception**: Authentic staples—Traditional Filter Coffee (₹40), Roasted Black Coffee (₹40), Lemon Honey Tea (₹30), and Herbal Green Tea (₹30)—remain untouched.
   - **Sub-100/Sub-150 Charm Anchors**: Base ₹100 &rarr; **₹99** &bull; Base ₹150 &rarr; **₹149** &bull; Base ₹200 &rarr; **₹199**.
   - **General 10-Step Increments**: Base ₹60 &rarr; **₹69** &bull; Base ₹70 &rarr; **₹79** &bull; Base ₹80 &rarr; **₹89** &bull; Base ₹110 &rarr; **₹119** &bull; Base ₹120 &rarr; **₹129** &bull; Base ₹140 &rarr; **₹149** &bull; Base ₹160 &rarr; **₹169**.
   - **Beach Packages**: Sunset Bonfire (₹1,199), Candlelight Setup (₹1,499), Neon Birthday Canopy (₹2,999), Sports Kit (₹499).

2. **Master SKU Catalog (81+ Items)**:
   - Category 1: Traditional Hot Beverages (4 items)
   - Category 2: Handcrafted Beach Mojitos & Coolers (13 items)
   - Category 3: 27 Signature Thick Shakes with **3-Variant Matrix** (Milkshake, Blended, Thickshake = 81 shake variants!)
   - Category 4: Artisanal Ice Creams & Sundaes (9 items)
   - Category 5: Crispy Beach Bites & Savory Snacks (10 items)
   - Category 6: Beach Experiences & Event Packages (4 items)

3. **9 Tables Live Floor Management & Itemized Table Bills**:
   - Dedicated tracking for Anchor Cafe's **9 dining tables** (`Table 1` to `Table 9`).
   - Live visual floor grid showing which tables are `🟢 Available (Empty)` or `🔴 Occupied (Active Bill)`.
   - Clicking any table opens its complete itemized bill showing:
     - Each item ordered (e.g. Filter Coffee, Water Bottle 1L, Thums Up, Kit Kat Shake, Fries)
     - Ordered quantity
     - Each item's unit cost
     - Line total cost
     - Grand total table bill
   - Waiters can append items to an active table in 1-tap!

4. **Zero-Friction 1-Tap Payment Confirmation (No New UPI QR Needed)**:
   - Guests pay using the cafe's existing counter UPI QR or cash.
   - Cashier simply ticks the payment method:
     - `[ 📱 PhonePe ]`
     - `[ 🔵 Google Pay ]`
     - `[ 💵 Cash ]`
     - `[ 💳 Card ]`
   - One click confirms payment, logs reconciliation, and immediately frees up the table!

5. **Packaged Drinking Water, Soft Drinks & Energy Drinks**:
   - Packaged Drinking Water (1 Litre @ ₹20, 500ml @ ₹10)
   - Kinley Club Soda (750ml @ ₹20)
   - Cold Soft Drinks: Thums Up (₹40), Coca-Cola (₹40), Sprite (₹40), Limca (₹40), Fanta (₹40), Diet Coke (₹50)
   - Energy Drinks: Red Bull (₹125), Sting Berry (₹20), Monster Energy (₹125)

4. **Real-Time Kitchen KDS (Kanban Board)**:
   - Socket.io live sync between POS and Kitchen touchscreens.
   - 3-Column status progression: `NEW / PENDING 🔴` &rarr; `PREPARING 🟡` &rarr; `READY / PLATED 🟢`.
   - Station filtering: *Beverage Bar (Coffee/Tea/Mojitos/Shakes)* vs *Hot Kitchen (Fries/Momos/Wings)*.
   - Synthesized Web Audio API nautical bell & chime alerts.

5. **Customer 4-Step Live Stepper**:
   - Accessible via Table QR codes or WhatsApp links (`/track/:orderNumber`).
   - Live progression: 1. Confirmed &bull; 2. Brewing & Frying &bull; 3. Plated & Ready &bull; 4. Delivered to Sand.
   - Direct WhatsApp integration with Anchor Cafe beachfront reception: `+91 7702897213`.

6. **Daily & Monthly Analytics & Day-End Closing (Z-Report)**:
   - MongoDB Aggregation Pipeline tracking 30-day revenue velocity and weekend tourist spikes.
   - Day-End Cashier Closing Audit with drawer cash discrepancy reconciliation.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend Runtime** | Node.js (v20+ LTS), Express.js (Modular Monolith) |
| **Database & ODM** | MongoDB Atlas Cloud with Mongoose v8 (Resilient fallback to in-memory) |
| **Real-Time Sync** | Socket.io (WebSocket with HTTP long-polling fallback) |
| **Frontend Core** | HTML5, Vanilla JavaScript (ESModules), Web Audio API |
| **Design System** | Luxury Coastal Palette (Navy `#0B2545`, Gold `#C9A86A`, Foam `#F4EBD9`, Sand `#FFFDF9`), Glassmorphism |
| **Payment Protocol** | NPCI UPI Intent Format, Dynamic QR Code Generator |
| **Testing Suite** | Jest, Supertest, MongoDB Memory Server |

---

## 💻 Beginner's Guide: Connecting MongoDB Atlas

1. **Sign Up**: Go to [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) and select the **M0 Free Forever** tier.
2. **Choose Region**: Select **`ap-south-1` (Mumbai)** for optimal latency to coastal Andhra Pradesh / Chirala.
3. **Database User**: Create a user (e.g. `anchor_admin` and password).
4. **Network Access**: Add IP Address `0.0.0.0/0` (Allow access from anywhere).
5. **Get URI**: Copy connection string and paste into your `.env` file:
   ```env
   MONGODB_URI=mongodb+srv://anchor_admin:<password>@cluster0.abcde.mongodb.net/anchor_cafe_db?retryWrites=true&w=majority&appName=Cluster0
   PORT=5000
   CAFE_NAME="Anchor Cafe"
   CAFE_LOCATION="Ramapuram Beach, Chirala, Choramandal Coast"
   CAFE_WHATSAPP="917702897213"
   CAFE_UPI_VPA="anchorcafe@icici"
   ```
   *(Note: If `MONGODB_URI` is left blank during local development, AnchorTrack automatically initializes a local in-memory database so you can test immediately without any setup!)*

---

## ⚡ Quick Start & Running Locally

### 1. Install Dependencies
```bash
npm install
```

### 2. Seed Menu Catalog (Optional - System auto-seeds on first launch!)
```bash
npm run seed
```

### 3. Run Development Server
```bash
npm start
```
The server will start at: **`http://localhost:5000`**

### 4. Direct Operational URLs:
- **Landing Hub**: [http://localhost:5000/](http://localhost:5000/)
- **Waiter & Cashier POS**: [http://localhost:5000/pos](http://localhost:5000/pos)
- **Kitchen Display System (KDS)**: [http://localhost:5000/kitchen](http://localhost:5000/kitchen)
- **Customer Live Order Tracker**: [http://localhost:5000/track](http://localhost:5000/track)
- **Management Analytics & Z-Report**: [http://localhost:5000/admin/analytics](http://localhost:5000/admin/analytics)

---

## 🧪 Running Automated Tests

To verify the psychological pricing engine and order lifecycle test suites:
```bash
npm test
```

Test files:
- `tests/pricing.test.js`: Validates authentic hot beverage rules and .99 charm calculations.
- `tests/orderFlow.test.js`: Validates complete order creation, KOT transitions, UPI QR generation, and payment recording.

---

## 📂 Project Structure

```text
website/
├── src/
│   ├── app.js                   # Express application configuration & routes
│   ├── server.js                # HTTP & Socket.io server entry point
│   ├── config/
│   │   └── database.js          # Resilient MongoDB Atlas connection & pool manager
│   ├── models/
│   │   ├── MenuItem.js          # Menu item schema with charm price pre-save hook
│   │   ├── Order.js             # Order schema with sequential daily number generator
│   │   ├── Payment.js           # Multi-channel payment transaction records
│   │   └── DailyReport.js       # Day-End Z-Report and financial closing records
│   ├── controllers/
│   │   ├── menuController.js    # Catalog filtering, 86ing, and auto-seeding
│   │   ├── orderController.js   # Order lifecycle, KOT live feed, and public tracking
│   │   ├── paymentController.js # Dynamic UPI QR generation, Cash, and Reconciliation
│   │   └── reportController.js  # MongoDB 30-day aggregation pipeline & Z-Report
│   ├── routes/
│   │   ├── menuRoutes.js
│   │   ├── orderRoutes.js
│   │   ├── paymentRoutes.js
│   │   └── reportRoutes.js
│   ├── sockets/
│   │   └── socketHandler.js     # WebSocket broadcaster for live KOT dispatch
│   ├── utils/
│   │   ├── pricingEngine.js     # Psychological charm pricing formulas
│   │   └── upiGenerator.js      # NPCI UPI URI and QR code generator
│   └── scripts/
│       ├── menuCatalogData.js   # 81+ Master SKU specifications and descriptions
│       └── seedMenu.js          # Standalone database seeder script
├── public/
│   ├── index.html               # Master AnchorTrack landing & portal switcher
│   ├── pos.html                 # Waiter & Cashier POS Terminal
│   ├── kitchen.html             # Kitchen Display System (KDS) Kanban board
│   ├── track.html               # Customer 4-Step Live Order Tracker
│   ├── analytics.html           # Management & Monthly Financial Dashboard
│   ├── css/
│   │   ├── main.css             # Luxury coastal design system (Navy, Gold, Foam)
│   │   ├── pos.css              # POS layout, cards grid, and variant modals
│   │   ├── kitchen.css          # KDS Kanban board, tickets, and status badges
│   │   ├── track.css            # Live animated stepper and WhatsApp styling
│   │   └── analytics.css        # KPI cards, SVG sales curves, and Z-report slip
│   ├── js/
│   │   ├── soundEffects.js      # Web Audio API nautical bell & order chimes
│   │   ├── pos.js               # POS interactions, shake modal, dynamic QR
│   │   ├── kitchen.js           # KDS Kanban updates, status transitions, chimes
│   │   ├── track.js             # Customer live tracking and WhatsApp link
│   │   └── analytics.js         # Daily KPI metrics, charts, and Z-Report closing
│   └── assets/
│       └── images/              # Generated coastal photography & branding
├── tests/
│   ├── pricing.test.js          # Unit tests for charm pricing algorithm
│   └── orderFlow.test.js        # Full integration test suite with in-memory DB
├── .env.example                 # Sample configuration template
├── package.json
└── README.md
```

---

## ⚓ Anchor Cafe Contact & Direct Support
- **Property**: Anchor Cafe
- **Location**: Ramapuram Beach, Chirala (Choramandal Coast), Andhra Pradesh
- **Beachfront Desk / Reception**: +91 7702897213
- **UPI Merchant ID**: `anchorcafe@icici`
