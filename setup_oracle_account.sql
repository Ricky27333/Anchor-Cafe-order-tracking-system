-- ====================================================================
-- AnchorTrack: Oracle Database Schema & Account Creation Script
-- Enterprise Restaurant POS & Order Tracking for Anchor Cafe
-- Dedicated Isolated Schema: ANCHOR_TRACK (Zero Company Interference)
-- ====================================================================

-- 1. SWITCH TO PLUGGABLE DATABASE (If using Oracle 12c/19c/21c/23c/XE)
-- If your PDB is named differently (e.g. ORCLPDB, FREEPDB1), change 'XEPDB1' below:
BEGIN
  EXECUTE IMMEDIATE 'ALTER SESSION SET CONTAINER = XEPDB1';
EXCEPTION
  WHEN OTHERS THEN
    NULL; -- Ignored if running in non-CDB / standalone database
END;
/

-- 2. CREATE NEW ISOLATED USER & SCHEMA
-- GUARANTEED ZERO INTERFERENCE WITH EXISTING COMPANY SCHEMAS
DECLARE
  v_user_exists NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_user_exists FROM all_users WHERE username = 'ANCHOR_TRACK';
  IF v_user_exists = 0 THEN
    EXECUTE IMMEDIATE 'CREATE USER ANCHOR_TRACK IDENTIFIED BY "AnchorCafe#2026" ' ||
                      'DEFAULT TABLESPACE USERS ' ||
                      'TEMPORARY TABLESPACE TEMP ' ||
                      'QUOTA UNLIMITED ON USERS';
    DBMS_OUTPUT.PUT_LINE('User ANCHOR_TRACK created successfully.');
  ELSE
    DBMS_OUTPUT.PUT_LINE('User ANCHOR_TRACK already exists. Updating password and quota...');
    EXECUTE IMMEDIATE 'ALTER USER ANCHOR_TRACK IDENTIFIED BY "AnchorCafe#2026" QUOTA UNLIMITED ON USERS';
  END IF;
END;
/

-- 3. GRANT STRICT MINIMUM PERMISSIONS (NO DBA, NO ACCESS TO ANY COMPANY SCHEMAS)
GRANT CONNECT, RESOURCE, CREATE SESSION, CREATE VIEW, CREATE SEQUENCE, CREATE TABLE TO ANCHOR_TRACK;
GRANT UNLIMITED TABLESPACE TO ANCHOR_TRACK;

-- 4. SWITCH SESSION TO THE NEW USER
ALTER SESSION SET CURRENT_SCHEMA = ANCHOR_TRACK;

-- 5. CLEAN RECREATION OF ANCHOR TRACK TABLES
BEGIN
  EXECUTE IMMEDIATE 'DROP TABLE ANCHOR_TRACK.DAILY_REPORTS CASCADE CONSTRAINTS';
  EXECUTE IMMEDIATE 'DROP TABLE ANCHOR_TRACK.PAYMENTS CASCADE CONSTRAINTS';
  EXECUTE IMMEDIATE 'DROP TABLE ANCHOR_TRACK.ORDER_ITEMS CASCADE CONSTRAINTS';
  EXECUTE IMMEDIATE 'DROP TABLE ANCHOR_TRACK.ORDERS CASCADE CONSTRAINTS';
  EXECUTE IMMEDIATE 'DROP TABLE ANCHOR_TRACK.EXPENSES CASCADE CONSTRAINTS';
  EXECUTE IMMEDIATE 'DROP TABLE ANCHOR_TRACK.CAFE_SETTINGS CASCADE CONSTRAINTS';
  EXECUTE IMMEDIATE 'DROP TABLE ANCHOR_TRACK.ITEM_VARIANTS CASCADE CONSTRAINTS';
  EXECUTE IMMEDIATE 'DROP TABLE ANCHOR_TRACK.MENU_ITEMS CASCADE CONSTRAINTS';
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END;
/

-- Table 1: Menu Items (All 79 Coastal offerings)
CREATE TABLE ANCHOR_TRACK.MENU_ITEMS (
    ID NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    SKU VARCHAR2(30) NOT NULL UNIQUE,
    TITLE VARCHAR2(150) NOT NULL,
    CATEGORY VARCHAR2(50) NOT NULL,
    SELLING_PRICE NUMBER(10, 2) NOT NULL,
    BASE_COST NUMBER(10, 2) NOT NULL,
    IS_MRP NUMBER(1) DEFAULT 0,
    HAS_VARIANTS NUMBER(1) DEFAULT 0,
    SERVING_SIZE VARCHAR2(100),
    DESCRIPTION VARCHAR2(500),
    IS_AVAILABLE NUMBER(1) DEFAULT 1,
    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table 2: Variants for Signature Shakes & Setups
CREATE TABLE ANCHOR_TRACK.ITEM_VARIANTS (
    ID NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    MENU_ITEM_ID NUMBER REFERENCES ANCHOR_TRACK.MENU_ITEMS(ID) ON DELETE CASCADE,
    VARIANT_NAME VARCHAR2(50) NOT NULL,
    SELLING_PRICE NUMBER(10, 2) NOT NULL,
    BASE_COST NUMBER(10, 2) NOT NULL
);

-- Table 3: Orders Master (Tables 1-9 & Takeaway)
CREATE TABLE ANCHOR_TRACK.ORDERS (
    ID NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ORDER_NUMBER VARCHAR2(30) NOT NULL UNIQUE,
    ORDER_TYPE VARCHAR2(20) DEFAULT 'DINE_IN',
    TABLE_NUMBER VARCHAR2(20) NOT NULL,
    CUSTOMER_NAME VARCHAR2(100) DEFAULT 'Guest',
    TOTAL_ITEMS NUMBER DEFAULT 0,
    SUBTOTAL_AMOUNT NUMBER(10, 2) NOT NULL,
    FINAL_TOTAL_AMOUNT NUMBER(10, 2) NOT NULL,
    ORDER_STATUS VARCHAR2(30) DEFAULT 'PENDING',
    PAYMENT_STATUS VARCHAR2(20) DEFAULT 'UNPAID',
    PAYMENT_METHOD VARCHAR2(20) DEFAULT 'PHONEPE',
    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    COMPLETED_AT TIMESTAMP
);

-- Table 4: Order Line Items (Item name, quantity, unit price, line total)
CREATE TABLE ANCHOR_TRACK.ORDER_ITEMS (
    ID NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ORDER_ID NUMBER REFERENCES ANCHOR_TRACK.ORDERS(ID) ON DELETE CASCADE,
    MENU_ITEM_ID NUMBER REFERENCES ANCHOR_TRACK.MENU_ITEMS(ID),
    TITLE VARCHAR2(150) NOT NULL,
    VARIANT VARCHAR2(50),
    UNIT_PRICE NUMBER(10, 2) NOT NULL,
    QUANTITY NUMBER NOT NULL,
    LINE_TOTAL NUMBER(10, 2) NOT NULL
);

-- Table 5: 1-Tap Payments (PhonePe, GPay, Cash, Card)
CREATE TABLE ANCHOR_TRACK.PAYMENTS (
    ID NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    TRANSACTION_ID VARCHAR2(50) NOT NULL UNIQUE,
    ORDER_ID NUMBER REFERENCES ANCHOR_TRACK.ORDERS(ID),
    ORDER_NUMBER VARCHAR2(30) NOT NULL,
    AMOUNT_RECEIVED NUMBER(10, 2) NOT NULL,
    PAYMENT_METHOD VARCHAR2(20) NOT NULL,
    STATUS VARCHAR2(20) DEFAULT 'SUCCESS',
    PROCESSED_BY VARCHAR2(50) DEFAULT 'Counter 1',
    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table 6: Daily Raw Materials & Expenses (Milk, Ice, Custom categories deducted from sales)
CREATE TABLE ANCHOR_TRACK.EXPENSES (
    ID NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    TITLE VARCHAR2(150) NOT NULL,
    CATEGORY VARCHAR2(100) DEFAULT 'MILK_DAIRY',
    AMOUNT NUMBER(10, 2) NOT NULL,
    DEDUCTED_FROM VARCHAR2(30) DEFAULT 'TODAYS_SALES',
    EXPENSE_DATE TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    RECORDED_BY VARCHAR2(100) DEFAULT 'Counter 1',
    NOTES VARCHAR2(300),
    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table 7: Cafe Settings (e.g. Dynamic Table Capacity)
CREATE TABLE ANCHOR_TRACK.CAFE_SETTINGS (
    KEY VARCHAR2(50) PRIMARY KEY,
    VALUE VARCHAR2(200) NOT NULL,
    DESCRIPTION VARCHAR2(200),
    UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO ANCHOR_TRACK.CAFE_SETTINGS (KEY, VALUE, DESCRIPTION)
VALUES ('table_count', '9', 'Active dining tables capacity on beach');

-- Table 8: Daily Reports (Daily Financial Closing & Z-Reports)
CREATE TABLE ANCHOR_TRACK.DAILY_REPORTS (
    ID NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    REPORT_DATE DATE NOT NULL UNIQUE,
    TOTAL_GROSS_SALES NUMBER(10, 2) DEFAULT 0,
    TOTAL_NET_SALES NUMBER(10, 2) DEFAULT 0,
    TOTAL_DISCOUNT_GIVEN NUMBER(10, 2) DEFAULT 0,
    TOTAL_ORDER_COUNT NUMBER DEFAULT 0,
    CASH_REVENUE NUMBER(10, 2) DEFAULT 0,
    UPI_REVENUE NUMBER(10, 2) DEFAULT 0,
    TOTAL_RAW_MATERIALS NUMBER(10, 2) DEFAULT 0,
    NET_OPERATING_PROFIT NUMBER(10, 2) DEFAULT 0,
    CLOSING_CASH_IN_DRAWER NUMBER(10, 2) DEFAULT 0,
    CASH_DISCREPANCY NUMBER(10, 2) DEFAULT 0,
    NOTES VARCHAR2(500),
    IS_CLOSED NUMBER(1) DEFAULT 1,
    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. INSERT COMPLETE 79 COASTAL MENU ITEMS
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('HB-001', 'Traditional Filter Coffee', 'hot-beverages', 40, 40, 0, 0, 'Brass Davarah (150ml)', 'Freshly decocted Chicory & Arabica blend served in authentic south Indian brass davarah.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('HB-002', 'Fresh Lemon Honey Tea', 'hot-beverages', 30, 30, 0, 0, 'Glass (180ml)', 'Steeped black tea infused with coastal farm lemons and organic raw honey.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('HB-003', 'Steamed Herbal Green Tea', 'hot-beverages', 30, 30, 0, 0, 'Glass (180ml)', 'Whole leaf green tea with subtle notes of mint and lemongrass.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('HB-004', 'Pure Roasted Black Coffee', 'hot-beverages', 40, 40, 0, 0, 'Glass (150ml)', 'Bold, dark roast Arabica espresso brew with no added chicory.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('MJ-001', 'Fresh Mint Lime Mojito', 'mojitos', 100, 100, 0, 0, 'Mug (350ml)', 'Crushed garden mint, freshly squeezed beach lime, sparkling soda & cane syrup.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('MJ-002', 'Virgin Strawberry Mojito', 'mojitos', 100, 100, 0, 0, 'Mug (350ml)', 'Muddled hill strawberries, mint leaves, crushed ice and bubbly soda.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('MJ-003', 'Sunset Glory (Golden Pineapple)', 'mojitos', 100, 100, 0, 0, 'Mug (350ml)', 'Tropical pineapple nectar, zesty lime, fresh mint sprigs & splash of club soda.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('MJ-004', 'Sunburst (Citrus Orange)', 'mojitos', 100, 100, 0, 0, 'Mug (350ml)', 'Sun-ripened orange citrus, crushed mint sprigs and sparkling soda.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('MJ-005', 'Electric Blue Curacao Mojito', 'mojitos', 100, 100, 0, 0, 'Mug (350ml)', 'Vibrant blue citrus cooler with lemon juice, mint leaves, and ice crystals.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('MJ-006', 'Sunrise (Pineapple & Orange Blend)', 'mojitos', 120, 120, 0, 0, 'Tall Glass (380ml)', 'Layered gradient of fresh pineapple juice, sweet orange pulp, and mint.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('MJ-007', 'Emerald Kiwi Mojito', 'mojitos', 120, 120, 0, 0, 'Tall Glass (380ml)', 'Tart kiwi fruit puree shaken with lime, mint and chilled tonic.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('MJ-008', 'Virgin Guava Mojito with Pink Salt', 'mojitos', 120, 120, 0, 0, 'Tall Glass (380ml)', 'Pink guava juice rimmed with Himalayan salt & mild chili dust, muddled with mint.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('MJ-009', 'Alphonso Mango Mojito', 'mojitos', 120, 120, 0, 0, 'Tall Glass (380ml)', 'Sweet Alphonso mango pulp blended with lime juice, mint and sparkling bubbles.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('MJ-010', 'Mint Berry Smash (Triple Berries)', 'mojitos', 140, 140, 0, 0, 'Tall Glass (400ml)', 'Muddled blackberries, raspberries, and blueberries with bruised garden mint.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('MJ-011', 'Virgin Jalapeño Guava', 'mojitos', 140, 140, 0, 0, 'Tall Glass (400ml)', 'Spicy coastal twist with sliced pickled jalapeño, sweet guava juice and fresh lime.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('MJ-012', 'Paradise (Guava & Pineapple)', 'mojitos', 140, 140, 0, 0, 'Tall Glass (400ml)', 'Tropical duo of guava and sweet pineapple with cooling crushed ice.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('MJ-013', 'Guava Pink Watermelon Lemonade', 'mojitos', 140, 140, 0, 0, 'Tall Glass (400ml)', 'Sweet watermelon puree, tropical guava, lemon juice & crushed mint.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('IC-001', 'Pure Madagascar Vanilla Ice Cream', 'icecream', 60, 60, 0, 0, 'Scoop in Cup/Waffle Cone', 'Velvety smooth churned ice cream infused with real Madagascar vanilla bean seeds.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('IC-002', 'Dark Cocoa Chocolate Gelato', 'icecream', 60, 60, 0, 0, 'Scoop in Cup/Waffle Cone', 'Rich 70% dark Belgian cocoa churned to creamy Italian gelato perfection.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('IC-003', 'Strawberry Berry Swirl', 'icecream', 60, 60, 0, 0, 'Scoop in Cup/Waffle Cone', 'Creamy dairy ice cream swirled with tart strawberry preserve ribbons.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('IC-004', 'Roasted Green Pista Ice Cream', 'icecream', 60, 60, 0, 0, 'Scoop in Cup/Waffle Cone', 'Nutty royal pistachio gelato studded with roasted Iranian pista slivers.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('IC-005', 'Golden Butterscotch Praline Scoop', 'icecream', 60, 60, 0, 0, 'Scoop in Cup/Waffle Cone', 'Caramel butterscotch scoop loaded with crunchy cashew praline toffee bits.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('IC-006', 'Royal Kaju Kishmish Scoop', 'icecream', 70, 70, 0, 0, 'Scoop in Cup/Waffle Cone', 'Creamy saffron scented base with golden raisins and whole roasted cashews.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('IC-007', 'Tropical Fruit Punch Scoop', 'icecream', 70, 70, 0, 0, 'Scoop in Cup/Waffle Cone', 'Exotic blend of mango, pineapple, cherry and papaya bits in sweet cream.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('IC-008', 'American Dry Fruits Sundae Scoop', 'icecream', 70, 70, 0, 0, 'Sundae Glass', 'Almonds, cashews, pistachios, black currants & honey drizzle over sweet cream.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('IC-009', 'Dulce De Leche Caramel Swirl', 'icecream', 80, 80, 0, 0, 'Sundae Glass', 'Slow-cooked golden dulce de leche caramel swirled in creamy milk gelato.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('SN-001', 'Golden Salted French Fries', 'snacks', 90, 90, 0, 0, '150g portion with dip', 'Double fried golden potato batons lightly tossed with sea salt. Served with hot ketchup & mayo.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('SN-002', 'Crispy Spiced Corn Samosa', 'snacks', 70, 70, 0, 0, '4 pieces with green chutney', 'Flaky pastry pockets stuffed with buttered corn, potatoes & beach spices.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('SN-003', 'Golden Crunchy Corn Rolls', 'snacks', 110, 110, 0, 0, '5 pieces with mayo', 'Crispy crumbed rolls packed with seasoned sweet corn and melted cheese.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('SN-004', 'Crumbed Vegetable Fingers', 'snacks', 110, 110, 0, 0, '5 pieces with dip', 'Seasoned carrot, pea and potato batons fried in panko crumbs until golden.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('SN-005', 'Steamed Vegetable Momos', 'snacks', 130, 130, 0, 0, '5 pieces with spicy dip', 'Delicate steamed Tibetan dumplings stuffed with cabbage, carrots, onion & ginger. Spicy chili dip.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('SN-006', 'Crispy Chicken Nuggets', 'snacks', 160, 160, 0, 0, '6 pieces with BBQ sauce', 'Tender minced chicken patties encased in a crunchy tempura batter.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('SN-007', 'Peri-Peri Chicken Popcorn', 'snacks', 160, 160, 0, 0, '150g tossed bucket', 'Bite-sized crispy chicken chunks dusted generously with African bird’s eye chili seasoning.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('SN-008', 'Juicy Steamed Chicken Momos', 'snacks', 140, 140, 0, 0, '5 pieces with red garlic dip', 'Thin wonton skins filled with scallion-infused spiced minced chicken. Served with spicy garlic chutney.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('SN-009', 'Golden Tender Chicken Fingers', 'snacks', 130, 130, 0, 0, '5 prime breaded strips', 'Whole chicken breast tenders coated in seasoned breading and flash fried.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('SN-010', 'BBQ Glazed Chicken Wings', 'snacks', 160, 160, 0, 0, '5 crispy coated wings', 'Crispy fried wings tossed in sweet, smoky and tangy coastal BBQ glaze.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('EXP-001', 'Night Beach Candlelight Table Setup', 'beach-services', 1500, 1500, 0, 0, 'Private Sand Setup (2-4 Guests)', 'Dedicated waterfront setup with lantern canopy, woven bamboo mats, candle centerpieces and flower petals.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('EXP-002', 'Birthday Beach Lighting & Neon Canopy', 'beach-services', 3000, 3000, 0, 0, 'Party Zone (6-12 Guests)', 'Fairy light tunnel, custom celebratory neon sign, balloon clusters, high-top cake table and audio bluetooth speaker.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('EXP-003', 'Sunset Beach Campfire & Bonfire Pit', 'beach-services', 1200, 1200, 0, 0, 'Campfire Circle (2 Hours)', 'Shoreline hardwood bonfire pit with low beach chairs, fire tender assistance, and marshmallow skewer kit.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('EXP-004', 'Beach Sports Kit Rental (Cricket / Volleyball)', 'beach-services', 500, 500, 0, 0, '2 Hours Kit Rental', 'Regulation volleyball sand net & match ball, plus lightweight beach cricket bats, rubber balls & stumps.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('SD-001', 'Packaged Drinking Water (1 Litre)', 'soft-drinks', 20, 20, 1, 0, '1000ml Sealed Chilled Bottle', 'Chilled pure mineral drinking water bottle.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('SD-002', 'Packaged Drinking Water (500ml)', 'soft-drinks', 10, 10, 1, 0, '500ml Sealed Chilled Bottle', 'Pure chilled drinking water for beach strolls.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('SD-003', 'Kinley Sparkling Club Soda', 'soft-drinks', 20, 20, 1, 0, '750ml Chilled Bottle', 'Crisp carbonated sparkling soda water.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('SD-004', 'Thums Up (Charged / Cold Can)', 'soft-drinks', 40, 40, 1, 0, '300ml Chilled Can / Bottle', 'Toofani strong fizzy cola served chilled with fresh lime slice.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('SD-005', 'Coca-Cola Classic', 'soft-drinks', 40, 40, 1, 0, '300ml Chilled Can / Bottle', 'Iconic chilled cola served with ice crystals.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('SD-006', 'Sprite Lime Fizz', 'soft-drinks', 40, 40, 1, 0, '300ml Chilled Can / Bottle', 'Crisp lemon-lime sparkling refresher.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('SD-007', 'Limca Fresh Lemon Drink', 'soft-drinks', 40, 40, 1, 0, '300ml Chilled Can / Bottle', 'Zesty cloudy lemon soda for sunny beach afternoons.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('SD-008', 'Fanta Orange Punch', 'soft-drinks', 40, 40, 1, 0, '300ml Chilled Can / Bottle', 'Vibrant sweet orange fizzy refreshment.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('SD-009', 'Diet Coke / Coke Zero', 'soft-drinks', 50, 50, 1, 0, '300ml Can', 'Zero calorie, zero sugar crisp chilled cola.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('ED-001', 'Red Bull Energy Drink', 'energy-drinks', 125, 125, 1, 0, '250ml Chilled Can', 'Vitalizes body and mind with taurine and alpine water. Served ice cold.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('ED-002', 'Sting Energy Berry', 'energy-drinks', 20, 20, 1, 0, '250ml Chilled Bottle', 'Electrifying berry energy booster with ginseng extract.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('ED-003', 'Monster Energy Original', 'energy-drinks', 125, 125, 1, 0, '350ml Chilled Can', 'Smooth intense energy blend for beach sports and late night bonfires.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('SH-01', 'Chocolate Shake', 'shakes', 100, 100, 0, 1, 'Glass / Tall Cup (350ml)', 'Indulgent Chocolate Shake crafted with whole dairy cream and artisan syrups. Available in Milkshake, Blended or Spoonable Thickshake.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('SH-02', 'Classic Vanilla Shake', 'shakes', 100, 100, 0, 1, 'Glass / Tall Cup (350ml)', 'Indulgent Classic Vanilla Shake crafted with whole dairy cream and artisan syrups. Available in Milkshake, Blended or Spoonable Thickshake.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('SH-03', 'Citrus Orange Shake', 'shakes', 100, 100, 0, 1, 'Glass / Tall Cup (350ml)', 'Indulgent Citrus Orange Shake crafted with whole dairy cream and artisan syrups. Available in Milkshake, Blended or Spoonable Thickshake.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('SH-04', 'Pink Watermelon Shake', 'shakes', 100, 100, 0, 1, 'Glass / Tall Cup (350ml)', 'Indulgent Pink Watermelon Shake crafted with whole dairy cream and artisan syrups. Available in Milkshake, Blended or Spoonable Thickshake.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('SH-05', 'Butterscotch Crunch Shake', 'shakes', 100, 100, 0, 1, 'Glass / Tall Cup (350ml)', 'Indulgent Butterscotch Crunch Shake crafted with whole dairy cream and artisan syrups. Available in Milkshake, Blended or Spoonable Thickshake.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('SH-06', 'Fresh Banana Honey Shake', 'shakes', 100, 100, 0, 1, 'Glass / Tall Cup (350ml)', 'Indulgent Fresh Banana Honey Shake crafted with whole dairy cream and artisan syrups. Available in Milkshake, Blended or Spoonable Thickshake.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('SH-07', 'Alphonso Mango Shake', 'shakes', 100, 100, 0, 1, 'Glass / Tall Cup (350ml)', 'Indulgent Alphonso Mango Shake crafted with whole dairy cream and artisan syrups. Available in Milkshake, Blended or Spoonable Thickshake.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('SH-08', 'Sweet Strawberry Shake', 'shakes', 100, 100, 0, 1, 'Glass / Tall Cup (350ml)', 'Indulgent Sweet Strawberry Shake crafted with whole dairy cream and artisan syrups. Available in Milkshake, Blended or Spoonable Thickshake.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('SH-09', 'Tropical Pineapple Shake', 'shakes', 100, 100, 0, 1, 'Glass / Tall Cup (350ml)', 'Indulgent Tropical Pineapple Shake crafted with whole dairy cream and artisan syrups. Available in Milkshake, Blended or Spoonable Thickshake.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('SH-10', 'Pink Guava Shake', 'shakes', 100, 100, 0, 1, 'Glass / Tall Cup (350ml)', 'Indulgent Pink Guava Shake crafted with whole dairy cream and artisan syrups. Available in Milkshake, Blended or Spoonable Thickshake.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('SH-11', 'Tangy Kiwi Shake', 'shakes', 110, 110, 0, 1, 'Glass / Tall Cup (350ml)', 'Indulgent Tangy Kiwi Shake crafted with whole dairy cream and artisan syrups. Available in Milkshake, Blended or Spoonable Thickshake.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('SH-12', 'Frosty Litchi Shake', 'shakes', 110, 110, 0, 1, 'Glass / Tall Cup (350ml)', 'Indulgent Frosty Litchi Shake crafted with whole dairy cream and artisan syrups. Available in Milkshake, Blended or Spoonable Thickshake.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('SH-13', 'Roasted Pista Shake', 'shakes', 110, 110, 0, 1, 'Glass / Tall Cup (350ml)', 'Indulgent Roasted Pista Shake crafted with whole dairy cream and artisan syrups. Available in Milkshake, Blended or Spoonable Thickshake.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('SH-14', 'Wild Blueberry Shake', 'shakes', 120, 120, 0, 1, 'Glass / Tall Cup (350ml)', 'Indulgent Wild Blueberry Shake crafted with whole dairy cream and artisan syrups. Available in Milkshake, Blended or Spoonable Thickshake.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('SH-15', 'Royal Kesar Badam Shake', 'shakes', 120, 120, 0, 1, 'Glass / Tall Cup (350ml)', 'Indulgent Royal Kesar Badam Shake crafted with whole dairy cream and artisan syrups. Available in Milkshake, Blended or Spoonable Thickshake.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('SH-16', 'Tart Black Currant Shake', 'shakes', 120, 120, 0, 1, 'Glass / Tall Cup (350ml)', 'Indulgent Tart Black Currant Shake crafted with whole dairy cream and artisan syrups. Available in Milkshake, Blended or Spoonable Thickshake.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('SH-17', 'Banana Dry Fruit Shake', 'shakes', 180, 180, 0, 1, 'Glass / Tall Cup (350ml)', 'Indulgent Banana Dry Fruit Shake crafted with whole dairy cream and artisan syrups. Available in Milkshake, Blended or Spoonable Thickshake.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('SH-18', 'Royal Dry Fruit Shake (Kaju, Badam, Pista)', 'shakes', 190, 190, 0, 1, 'Glass / Tall Cup (350ml)', 'Indulgent Royal Dry Fruit Shake (Kaju, Badam, Pista) crafted with whole dairy cream and artisan syrups. Available in Milkshake, Blended or Spoonable Thickshake.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('SH-19', 'Banana Bonkers Shake', 'shakes', 120, 120, 0, 1, 'Glass / Tall Cup (350ml)', 'Indulgent Banana Bonkers Shake crafted with whole dairy cream and artisan syrups. Available in Milkshake, Blended or Spoonable Thickshake.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('SH-20', 'Kit Kat Chunky Shake', 'shakes', 130, 130, 0, 1, 'Glass / Tall Cup (350ml)', 'Indulgent Kit Kat Chunky Shake crafted with whole dairy cream and artisan syrups. Available in Milkshake, Blended or Spoonable Thickshake.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('SH-21', 'Oreo Cookies & Cream Shake', 'shakes', 130, 130, 0, 1, 'Glass / Tall Cup (350ml)', 'Indulgent Oreo Cookies & Cream Shake crafted with whole dairy cream and artisan syrups. Available in Milkshake, Blended or Spoonable Thickshake.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('SH-22', 'Cadbury 5 Star Nougat Shake', 'shakes', 130, 130, 0, 1, 'Glass / Tall Cup (350ml)', 'Indulgent Cadbury 5 Star Nougat Shake crafted with whole dairy cream and artisan syrups. Available in Milkshake, Blended or Spoonable Thickshake.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('SH-23', 'Rainbow Gems Fun Shake', 'shakes', 130, 130, 0, 1, 'Glass / Tall Cup (350ml)', 'Indulgent Rainbow Gems Fun Shake crafted with whole dairy cream and artisan syrups. Available in Milkshake, Blended or Spoonable Thickshake.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('SH-24', 'Snickers Caramel Peanut Shake', 'shakes', 130, 130, 0, 1, 'Glass / Tall Cup (350ml)', 'Indulgent Snickers Caramel Peanut Shake crafted with whole dairy cream and artisan syrups. Available in Milkshake, Blended or Spoonable Thickshake.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('SH-25', 'Blended Brownie Fudge Shake', 'shakes', 140, 140, 0, 1, 'Glass / Tall Cup (350ml)', 'Indulgent Blended Brownie Fudge Shake crafted with whole dairy cream and artisan syrups. Available in Milkshake, Blended or Spoonable Thickshake.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('SH-26', 'Choco Butterscotch Praline', 'shakes', 140, 140, 0, 1, 'Glass / Tall Cup (350ml)', 'Indulgent Choco Butterscotch Praline crafted with whole dairy cream and artisan syrups. Available in Milkshake, Blended or Spoonable Thickshake.');
INSERT INTO ANCHOR_TRACK.MENU_ITEMS (SKU, TITLE, CATEGORY, SELLING_PRICE, BASE_COST, IS_MRP, HAS_VARIANTS, SERVING_SIZE, DESCRIPTION) VALUES ('SH-27', 'Choco-Nut Crunch Supreme', 'shakes', 140, 140, 0, 1, 'Glass / Tall Cup (350ml)', 'Indulgent Choco-Nut Crunch Supreme crafted with whole dairy cream and artisan syrups. Available in Milkshake, Blended or Spoonable Thickshake.');

COMMIT;
