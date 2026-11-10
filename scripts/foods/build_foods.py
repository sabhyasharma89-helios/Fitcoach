"""
Builds src/data/foods.json — FitOS's bundled Indian foods dataset.

Every value comes from a published source; nothing is estimated:
  * INDB  — Indian Nutrient Databank (Jaacks et al.), recipe values per 100 g and per serving,
            computed from ICMR-NIN IFCT 2017/2004 ingredients.  github.com/lindsayjaacks/Indian-Nutrient-Databank-INDB-
  * IFCT  — ICMR-NIN Indian Food Composition Tables 2017 (Longvah et al.), raw foods per 100 g edible
            portion, via the @ifct2017/compositions data package (energy given in kJ → kcal ÷ 4.184).
  * CoFID — UK McCance & Widdowson's Composition of Foods Integrated Dataset 2021 (as bundled with INDB).
  * USDA  — USDA FoodData Central (as bundled with INDB).

Quality gates (an item is dropped, not "fixed", if it fails):
  * Atwater check: |4·carb + 4·protein + 9·fat (+ 2·fibre) − kcal| must be ≤ 12 % of kcal (+10 kcal slack).
  * INDB serving weight must be consistent between kcal and protein ratios and between 15 g and 600 g.

Usage:
  python3 -I scripts/foods/build_foods.py <INDB dir> <ifct2017 compositions index.csv> <out.json>
"""
import csv
import json
import sys

import openpyxl

INDB_DIR, IFCT_CSV, OUT = sys.argv[1], sys.argv[2], sys.argv[3]

INDB_CITE = 'Indian Nutrient Databank (INDB), Jaacks et al., from ICMR-NIN IFCT 2017'
IFCT_CITE = 'ICMR-NIN Indian Food Composition Tables 2017 (Longvah et al.)'
COFID_CITE = "UK CoFID 2021 (McCance & Widdowson's), via INDB"
USDA_CITE = 'USDA FoodData Central, via INDB'

# ── INDB recipes: (code, display name, category, serving label override or None) ──
INDB = [
    # breads
    ('ASC096', 'Chapati / roti', 'Breads', None),
    ('ASC097', 'Paratha, plain', 'Breads', None),
    ('ASC098', 'Aloo paratha', 'Breads', None),
    ('ASC099', 'Mooli paratha', 'Breads', None),
    ('ASC100', 'Gobhi paratha', 'Breads', None),
    ('ASC105', 'Paneer paratha', 'Breads', None),
    ('ASC103', 'Matar paratha', 'Breads', None),
    ('BFP110', 'Methi paratha', 'Breads', None),
    ('ASC112', 'Tandoori paratha', 'Breads', None),
    ('ASC142', 'Naan', 'Breads', None),
    ('ASC150', 'Makki ki roti', 'Breads', None),
    ('OSR104', 'Methi thepla', 'Breads', None),
    ('OSR102', 'Khakhra', 'Breads', None),
    ('BFP575', 'Soya roti', 'Breads', None),
    ('ASC472', 'Paushtik (multigrain) roti', 'Breads', None),
    # rice & one-pot
    ('ASC113', 'Rice, boiled (plain)', 'Rice & grains', None),
    ('ASC114', 'Pulao, plain', 'Rice & grains', None),
    ('BFP134', 'Jeera rice', 'Rice & grains', None),
    ('ASC115', 'Vegetable pulao', 'Rice & grains', None),
    ('BFP136', 'Matar pulao', 'Rice & grains', None),
    ('BFP142', 'Chicken pulao', 'Rice & grains', None),
    ('ASC122', 'Mutton biryani', 'Rice & grains', None),
    ('ASC123', 'Vegetable biryani', 'Rice & grains', None),
    ('ASC124', 'Lemon rice', 'Rice & grains', None),
    ('ASC126', 'Curd rice', 'Rice & grains', None),
    ('BFP144', 'Khichdi, plain', 'Rice & grains', None),
    ('OSR107', 'Quinoa khichdi', 'Rice & grains', None),
    ('ASC129', 'Fried rice (Chinese style)', 'Rice & grains', None),
    ('ASC134', 'Vegetable chowmein', 'Rice & grains', None),
    ('BFP132', 'Vangi bhath (brinjal rice)', 'Rice & grains', None),
    # breakfast
    ('ASC050', 'Oats porridge (with milk)', 'Breakfast', None),
    ('ASC047', 'Daliya, sweet (cracked wheat porridge)', 'Breakfast', None),
    ('BFP039', 'Upma (suji/rava)', 'Breakfast', None),
    ('BFP043', 'Vegetable upma', 'Breakfast', None),
    ('BFP045', 'Vegetable poha', 'Breakfast', None),
    ('ASC144', 'Idli', 'Breakfast', None),
    ('BFP579', 'Rava idli', 'Breakfast', None),
    ('ASC146', 'Masala dosa', 'Breakfast', None),
    ('BFP150', 'Masala dosa, mixed vegetable filling', 'Breakfast', None),
    ('ASC147', 'Rava dosa', 'Breakfast', None),
    ('BFP153', 'Appam', 'Breakfast', None),
    ('OSR100', 'Besan chilla', 'Breakfast', None),
    ('BFP046', 'Moong dal chilla, stuffed', 'Breakfast', None),
    ('BFP047', 'Paneer stuffed chilla', 'Breakfast', None),
    ('ASC051', 'Cornflakes with milk', 'Breakfast', None),
    ('ASC059', 'Egg bhurji (scrambled egg)', 'Eggs', None),
    ('ASC061', 'Omelette, plain', 'Eggs', None),
    ('BFP052', 'Anda bhujia', 'Eggs', None),
    ('OSR072', 'Corn omelette', 'Eggs', None),
    ('BFP240', 'Egg curry', 'Eggs', None),
    # dals & legumes
    ('ASC151', 'Moong dal (dhuli)', 'Dals & legumes', None),
    ('ASC152', 'Urad dal (dhuli)', 'Dals & legumes', None),
    ('ASC153', 'Chana dal with lauki', 'Dals & legumes', None),
    ('ASC155', 'Mixed dal', 'Dals & legumes', None),
    ('ASC156', 'Whole moong dal', 'Dals & legumes', None),
    ('ASC157', 'Whole masoor dal', 'Dals & legumes', None),
    ('ASC159', 'Whole urad dal', 'Dals & legumes', None),
    ('BFP172', 'Arhar (toor) dal with palak', 'Dals & legumes', None),
    ('BFP170', 'Khatti dal', 'Dals & legumes', None),
    ('OSR139', 'Dal makhani', 'Dals & legumes', None),
    ('OSR142', 'Chana dal', 'Dals & legumes', None),
    ('OSR144', 'Panchmel dal', 'Dals & legumes', None),
    ('ASC165', 'Rajma curry', 'Dals & legumes', None),
    ('ASC162', 'Chole (white chickpea curry)', 'Dals & legumes', None),
    ('ASC161', 'Kala chana curry', 'Dals & legumes', None),
    ('ASC163', 'Lobia curry', 'Dals & legumes', None),
    ('ASC164', 'Soyabean curry', 'Dals & legumes', None),
    ('BFP206', 'Soya chunks with peas', 'Dals & legumes', None),
    ('BFP204', 'Soya chunks korma', 'Dals & legumes', None),
    ('ASC167', 'Sambar', 'Dals & legumes', None),
    ('BFP176', 'Rasam (tamarind)', 'Dals & legumes', None),
    ('ASC170', 'Sprouted moong chaat', 'Dals & legumes', None),
    ('ASC259', 'Sprouted moong salad', 'Dals & legumes', None),
    ('OSR141', 'Dalma', 'Dals & legumes', None),
    # vegetables
    ('ASC171', 'Aloo gobhi', 'Vegetables', None),
    ('ASC190', 'Aloo matar', 'Vegetables', None),
    ('BFP239', 'Aloo sabzi', 'Vegetables', None),
    ('ASC178', 'Sookhe aloo (dry potato)', 'Vegetables', None),
    ('ASC173', 'Cabbage matar', 'Vegetables', None),
    ('ASC174', 'Gajar methi', 'Vegetables', None),
    ('ASC175', 'Aloo methi', 'Vegetables', None),
    ('BFP257', 'Palak aloo', 'Vegetables', None),
    ('ASC177', 'Baingan bharta', 'Vegetables', None),
    ('ASC217', 'Sarson ka saag', 'Vegetables', None),
    ('BFP269', 'Bhindi sabzi', 'Vegetables', None),
    ('ASC184', 'Bharwa bhindi', 'Vegetables', None),
    ('ASC185', 'Bharwa tinde', 'Vegetables', None),
    ('ASC179', 'Beans thoran (with coconut)', 'Vegetables', None),
    ('ASC219', 'Avial', 'Vegetables', None),
    ('BFP277', 'Vegetable jalfrezi', 'Vegetables', None),
    ('BFP278', 'Vegetable stir fry', 'Vegetables', None),
    ('BFP205', 'Mushroom matar', 'Vegetables', None),
    ('BFP208', 'Palak mushroom', 'Vegetables', None),
    ('BFP276', 'Gobhi matar aloo', 'Vegetables', None),
    ('BFP258', 'Mooli bhujia', 'Vegetables', None),
    ('BFP242', 'Dahi aloo', 'Vegetables', None),
    ('BFP263', 'Arbi, dry', 'Vegetables', None),
    ('OSR112', 'Pav bhaji (bhaji only)', 'Vegetables', None),
    # paneer
    ('ASC191', 'Matar paneer', 'Paneer', None),
    ('ASC215', 'Palak paneer', 'Paneer', None),
    ('ASC221', 'Shahi paneer', 'Paneer', None),
    ('ASC222', 'Paneer butter masala', 'Paneer', None),
    ('ASC226', 'Kadhai paneer', 'Paneer', None),
    ('ASC195', 'Paneer curry', 'Paneer', None),
    ('ASC381', 'Paneer tikka', 'Paneer', None),
    ('OSR077', 'Paneer lababdar', 'Paneer', None),
    ('OSR074', 'Paneer do pyaza', 'Paneer', None),
    ('ASC149', 'Paneer kathi roll', 'Paneer', None),
    # chicken / meat / fish
    ('ASC240', 'Chicken curry', 'Chicken, meat & fish', None),
    ('ASC242', 'Butter chicken', 'Chicken, meat & fish', None),
    ('ASC241', 'Tandoori chicken', 'Chicken, meat & fish', None),
    ('BFP222', 'Chicken korma', 'Chicken, meat & fish', None),
    ('BFP214', 'Shahi chicken masala', 'Chicken, meat & fish', None),
    ('BFP216', 'Tomato chicken', 'Chicken, meat & fish', None),
    ('BFP220', 'Ginger chicken', 'Chicken, meat & fish', None),
    ('ASC244', 'Chilli chicken', 'Chicken, meat & fish', None),
    ('ASC233', 'Chicken yakhni', 'Chicken, meat & fish', None),
    ('OSR062', 'Afghani chicken', 'Chicken, meat & fish', None),
    ('OSR066', 'Handi chicken', 'Chicken, meat & fish', None),
    ('BFP212', 'Roast chicken', 'Chicken, meat & fish', None),
    ('BFP090', 'Chicken stew', 'Chicken, meat & fish', None),
    ('ASC227', 'Rogan josh', 'Chicken, meat & fish', None),
    ('BFP194', 'Mutton korma', 'Chicken, meat & fish', None),
    ('ASC234', 'Mutton do pyaza', 'Chicken, meat & fish', None),
    ('ASC229', 'Keema matar', 'Chicken, meat & fish', None),
    ('BFP199', 'Mutton seekh kebab', 'Chicken, meat & fish', None),
    ('BFP198', 'Boti kebab', 'Chicken, meat & fish', None),
    ('ASC246', 'Fish curry', 'Chicken, meat & fish', None),
    ('BFP223', 'Bengali fish curry', 'Chicken, meat & fish', None),
    ('ASC251', 'Fish tikka', 'Chicken, meat & fish', None),
    ('ASC252', 'Tandoori fish', 'Chicken, meat & fish', None),
    ('BFP230', 'Prawn curry (with coconut)', 'Chicken, meat & fish', None),
    # raita, salads, soups
    ('ASC273', 'Cucumber raita', 'Raita, salad & soup', None),
    ('ASC269', 'Tomato onion raita', 'Raita, salad & soup', None),
    ('ASC275', 'Mint raita', 'Raita, salad & soup', None),
    ('BFP316', 'Carrot raita', 'Raita, salad & soup', None),
    ('ASC272', 'Lauki raita', 'Raita, salad & soup', None),
    ('ASC260', 'Tossed salad', 'Raita, salad & soup', None),
    ('ASC258', 'Mixed pulse and vegetable salad', 'Raita, salad & soup', None),
    ('ASC265', 'Fruit salad', 'Raita, salad & soup', None),
    ('ASC079', 'Tomato soup, clear', 'Raita, salad & soup', None),
    ('BFP074', 'Mixed vegetable soup', 'Raita, salad & soup', None),
    ('ASC092', 'Hot and sour soup', 'Raita, salad & soup', None),
    ('ASC087', 'Chicken sweet corn soup', 'Raita, salad & soup', None),
    ('ASC080', 'Lentil soup', 'Raita, salad & soup', None),
    # snacks & drinks
    ('ASC474', 'Dhokla', 'Snacks', None),
    ('BFP440', 'Dhokla, instant', 'Snacks', None),
    ('ASC382', 'Peanut chikki', 'Snacks', None),
    ('ASC386', 'Coconut chutney', 'Snacks', None),
    ('ASC387', 'Mint-coriander chutney', 'Snacks', None),
    ('ASC001', 'Tea with milk and sugar (chai)', 'Drinks', None),
    ('BFP008', 'Coffee, filter/steeped, with milk', 'Drinks', None),
    ('ASC021', 'Lassi, sweet', 'Drinks', None),
    ('ASC022', 'Lassi, salted', 'Drinks', None),
    ('OSR002', 'Sattu drink', 'Drinks', None),
    ('ASC016', 'Banana milkshake', 'Drinks', None),
    ('BFP024', 'Jal jeera', 'Drinks', None),
    # sweets
    ('ASC282', 'Rice kheer', 'Sweets', None),
    ('ASC293', 'Suji halwa', 'Sweets', None),
    ('ASC295', 'Gajar halwa', 'Sweets', None),
    ('BFP392', 'Rasgulla', 'Sweets', None),
    ('BFP393', 'Rasmalai', 'Sweets', None),
    ('ASC343', 'Besan ladoo', 'Sweets', None),
    ('ASC339', 'Kaju katli', 'Sweets', None),
    ('OSR024', 'Shrikhand', 'Sweets', None),
    ('ASC321', 'Kulfi', 'Sweets', None),
]

# ── IFCT 2017 raw foods: (code, display name, category, serving grams, serving label) ──
# Serving sizes are FitOS portion conventions (you can always log grams).
IFCT = [
    ('A015', 'Rice, white, raw (uncooked)', 'Rice & grains', 50, '¼ cup uncooked (50 g)'),
    ('A013', 'Rice, brown, raw (uncooked)', 'Rice & grains', 50, '¼ cup uncooked (50 g)'),
    ('A019', 'Wheat flour (atta)', 'Rice & grains', 30, '1 chapati’s worth (30 g)'),
    ('A022', 'Semolina (suji/rava)', 'Rice & grains', 40, '40 g'),
    ('A011', 'Rice flakes (poha), raw', 'Rice & grains', 40, '40 g'),
    ('A012', 'Puffed rice (murmura)', 'Rice & grains', 20, '1 cup (20 g)'),
    ('A003', 'Bajra (pearl millet)', 'Rice & grains', 40, '40 g'),
    ('A005', 'Jowar (sorghum)', 'Rice & grains', 40, '40 g'),
    ('A010', 'Ragi (finger millet)', 'Rice & grains', 40, '40 g'),
    ('A009', 'Quinoa, raw', 'Rice & grains', 50, '50 g uncooked'),
    ('A021', 'Bulgur wheat (daliya), raw', 'Rice & grains', 40, '40 g'),
    ('B010', 'Moong dal, raw', 'Dals & legumes', 30, '30 g dry'),
    ('B013', 'Masoor dal, raw', 'Dals & legumes', 30, '30 g dry'),
    ('B021', 'Toor/arhar dal, raw', 'Dals & legumes', 30, '30 g dry'),
    ('B001', 'Chana dal, raw', 'Dals & legumes', 30, '30 g dry'),
    ('B003', 'Urad dal, raw', 'Dals & legumes', 30, '30 g dry'),
    ('B020', 'Rajma (red), raw', 'Dals & legumes', 40, '40 g dry'),
    ('B002', 'Kala chana (whole Bengal gram), raw', 'Dals & legumes', 40, '40 g dry'),
    ('B025', 'Soya bean, white, raw', 'Dals & legumes', 30, '30 g dry'),
    ('M004', 'Egg, whole, boiled', 'Eggs', 50, '1 egg (50 g edible)'),
    ('M005', 'Egg white, boiled', 'Eggs', 33, '1 egg white (33 g)'),
    ('M007', 'Egg omelette (IFCT)', 'Eggs', 60, '1-egg omelette (60 g)'),
    ('L002', 'Milk, cow, whole', 'Dairy', 200, '1 glass (200 ml)'),
    ('L001', 'Milk, buffalo, whole', 'Dairy', 200, '1 glass (200 ml)'),
    ('L003', 'Paneer', 'Dairy', 50, '50 g'),
    ('L004', 'Khoa', 'Dairy', 20, '20 g'),
    ('N003', 'Chicken breast, skinless, raw', 'Chicken, meat & fish', 100, '100 g raw'),
    ('N002', 'Chicken thigh, skinless, raw', 'Chicken, meat & fish', 100, '100 g raw'),
    ('O003', 'Goat meat (mutton), leg, raw', 'Chicken, meat & fish', 100, '100 g raw'),
    ('S006', 'Rohu fish, raw', 'Chicken, meat & fish', 100, '100 g raw'),
    ('P055', 'Pomfret, black, raw', 'Chicken, meat & fish', 100, '100 g raw'),
    ('P034', 'Mackerel (bangda), raw', 'Chicken, meat & fish', 100, '100 g raw'),
    ('P084', 'Tuna, raw', 'Chicken, meat & fish', 100, '100 g raw'),
    ('S008', 'Prawns, big, raw', 'Chicken, meat & fish', 100, '100 g raw'),
    ('E012', 'Banana, ripe (robusta)', 'Fruit', 100, '1 medium (100 g edible)'),
    ('E001', 'Apple', 'Fruit', 150, '1 medium (150 g edible)'),
    ('E049', 'Papaya, ripe', 'Fruit', 150, '1 cup cubes (150 g)'),
    ('E028', 'Guava, white flesh', 'Fruit', 100, '1 medium (100 g)'),
    ('E047', 'Orange', 'Fruit', 130, '1 medium (130 g edible)'),
    ('E055', 'Pomegranate seeds', 'Fruit', 100, '½ cup (100 g)'),
    ('E065', 'Watermelon', 'Fruit', 200, '1 cup cubes (200 g)'),
    ('E036', 'Mango, ripe (banganapalli)', 'Fruit', 150, '1 cup (150 g)'),
    ('E026', 'Grapes, green seedless', 'Fruit', 100, '100 g'),
    ('E053', 'Pineapple', 'Fruit', 150, '1 cup (150 g)'),
    ('E045', 'Musk melon', 'Fruit', 150, '1 cup (150 g)'),
    ('E018', 'Dates, dry, dark brown', 'Fruit', 8, '1 date (8 g)'),
    ('D043', 'Cucumber', 'Vegetables (raw)', 100, '100 g'),
    ('D075', 'Tomato, ripe', 'Vegetables (raw)', 100, '1 medium (100 g)'),
    ('G017', 'Onion', 'Vegetables (raw)', 70, '1 medium (70 g)'),
    ('F006', 'Potato, raw', 'Vegetables (raw)', 100, '1 medium (100 g)'),
    ('F013', 'Sweet potato, raw', 'Vegetables (raw)', 100, '100 g'),
    ('C033', 'Spinach (palak), raw', 'Vegetables (raw)', 100, '100 g'),
    ('F002', 'Carrot', 'Vegetables (raw)', 70, '1 medium (70 g)'),
    ('D036', 'Cauliflower', 'Vegetables (raw)', 100, '100 g'),
    ('C015', 'Cabbage', 'Vegetables (raw)', 100, '100 g'),
    ('D056', 'Bhindi (ladies finger), raw', 'Vegetables (raw)', 100, '100 g'),
    ('D061', 'Green peas, fresh', 'Vegetables (raw)', 50, '50 g'),
    ('D033', 'Capsicum, green', 'Vegetables (raw)', 100, '100 g'),
    ('J001', 'Button mushroom', 'Vegetables (raw)', 100, '100 g'),
    ('D007', 'Lauki (bottle gourd)', 'Vegetables (raw)', 100, '100 g'),
    ('A008', 'Sweet corn, tender', 'Vegetables (raw)', 100, '100 g'),
    ('H001', 'Almonds', 'Nuts & seeds', 10, '8–10 almonds (10 g)'),
    ('H005', 'Cashew nuts', 'Nuts & seeds', 10, '6–7 cashews (10 g)'),
    ('H021', 'Walnuts', 'Nuts & seeds', 10, '10 g'),
    ('H012', 'Groundnut (peanuts), raw', 'Nuts & seeds', 20, '20 g'),
    ('H018', 'Pistachios', 'Nuts & seeds', 10, '10 g'),
    ('H014', 'Flaxseeds (alsi)', 'Nuts & seeds', 10, '1 tbsp (10 g)'),
    ('H011', 'Sesame seeds (til), white', 'Nuts & seeds', 10, '1 tbsp (10 g)'),
    ('H007', 'Coconut, fresh', 'Nuts & seeds', 20, '20 g'),
    ('T013', 'Ghee', 'Oils & fats', 5, '1 tsp (5 g)'),
    ('T006', 'Mustard oil', 'Oils & fats', 5, '1 tsp (5 g)'),
    ('T005', 'Groundnut oil', 'Oils & fats', 5, '1 tsp (5 g)'),
    ('T012', 'Sunflower oil', 'Oils & fats', 5, '1 tsp (5 g)'),
    ('T008', 'Rice bran oil', 'Oils & fats', 5, '1 tsp (5 g)'),
    ('I001', 'Jaggery (gur)', 'Sugar & sweeteners', 10, '10 g'),
    ('K002', 'Coconut water', 'Drinks', 200, '1 glass (200 ml)'),
]

# ── UK CoFID / USDA ingredients bundled with INDB: (file, food_code, display, category, grams, label) ──
EXTRA = [
    ('UK_fct.xlsx', 'A508', 'Rolled oats, raw', 'Breakfast', 40, '40 g (½ cup)'),
    ('UK_fct.xlsx', 'L520', 'Curd / plain yogurt (whole milk)', 'Dairy', 100, '1 katori (100 g)'),
    ('UK_fct.xlsx', 'L502', 'Cottage cheese, plain', 'Dairy', 100, '100 g'),
    ('UK_fct.xlsx', 'L500', 'Cheddar cheese', 'Dairy', 20, '1 slice (20 g)'),
    ('UK_fct.xlsx', 'U511', 'Bread, white', 'Breads', 30, '1 slice (30 g)'),
    ('UK_fct.xlsx', 'U501', 'Bread, brown', 'Breads', 30, '1 slice (30 g)'),
    ('UK_fct.xlsx', 'T500', 'Butter, salted', 'Oils & fats', 5, '1 tsp (5 g)'),
    ('UK_fct.xlsx', 'T502', 'Olive oil', 'Oils & fats', 5, '1 tsp (5 g)'),
    ('UK_fct.xlsx', 'I502', 'Sugar, white', 'Sugar & sweeteners', 5, '1 tsp (5 g)'),
    ('UK_fct.xlsx', 'I507', 'Honey', 'Sugar & sweeteners', 7, '1 tsp (7 g)'),
    ('UK_fct.xlsx', 'B504', 'Peanut butter, smooth', 'Nuts & seeds', 16, '1 tbsp (16 g)'),
    ('UK_fct.xlsx', 'B505', 'Peanuts, dry roasted', 'Nuts & seeds', 20, '20 g'),
    ('UK_fct.xlsx', 'B506', 'Tofu, steamed', 'Dals & legumes', 100, '100 g'),
    ('UK_fct.xlsx', 'A504', 'Besan (gram flour)', 'Rice & grains', 30, '30 g'),
    ('UK_fct.xlsx', 'B501', 'Moong sprouts, boiled', 'Dals & legumes', 100, '100 g'),
    ('UK_fct.xlsx', 'C500', 'Broccoli, raw', 'Vegetables (raw)', 100, '100 g'),
    ('UK_fct.xlsx', 'E502', 'Kiwi fruit', 'Fruit', 75, '1 kiwi (75 g)'),
    ('UK_fct.xlsx', 'I509', 'Dark chocolate (plain)', 'Snacks', 10, '2 squares (10 g)'),
    ('UK_fct.xlsx', 'U500', 'Digestive biscuit, plain', 'Snacks', 15, '1 biscuit (15 g)'),
    ('UK_fct.xlsx', 'A507', 'Pasta, white, dry', 'Rice & grains', 60, '60 g dry'),
    ('US_fct.xlsx', 'L521', 'Buttermilk (chaas), whole', 'Drinks', 200, '1 glass (200 ml)'),
    ('US_fct.xlsx', 'H506', 'Chia seeds', 'Nuts & seeds', 10, '1 tbsp (10 g)'),
    ('US_fct.xlsx', 'B511', 'Roasted chana', 'Snacks', 30, '30 g'),
    ('US_fct.xlsx', 'H503', 'Makhana / lotus seeds, dried', 'Snacks', 20, '1 cup (20 g)'),
]


# INDB serving weights that are implausible for the unit named (e.g. "1 rasgulla = 342 g" — the
# recipe batch, not one piece). We drop the serving rather than invent a weight; log these in grams.
DROP_SERVING = {'BFP392', 'BFP393', 'ASC321', 'ASC252', 'BFP046', 'BFP047', 'BFP144'}
RELABEL_SERVING = {'ASC242': 'serving'}


def num(v):
    if v is None or v == '' or v in ('NA', 'N', 'Tr'):
        return 0.0 if v == 'Tr' else None
    return float(v)


def atwater_ok(kcal, p, c, f, fib):
    # Sources differ on whether fibre contributes energy (IFCT 2017: no; INDB/CoFID: 2 kcal/g),
    # so accept either convention.
    base = 4 * c + 4 * p + 9 * f
    with_fibre = base + 2 * (fib or 0)
    ok = any(abs(x - kcal) <= 0.12 * kcal + 10 for x in (base, with_fibre))
    return ok, with_fibre


def r1(x):
    return None if x is None else round(x + 0.0, 1)


rejected = []
foods = []


def add(fid, name, cat, per100, serving, source, code):
    ok, calc = atwater_ok(per100['kcal'], per100['protein'], per100['carbs'], per100['fat'], per100['fibre'])
    if not ok:
        rejected.append(f'{code} {name}: kcal {per100["kcal"]:.0f} vs Atwater {calc:.0f}')
        return
    foods.append({
        'id': fid,
        'name': name,
        'category': cat,
        'per100': {k: r1(v) for k, v in per100.items()},
        'serving': serving,
        'source': source,
        'sourceCode': code,
    })


# INDB
wb = openpyxl.load_workbook(f'{INDB_DIR}/INDB.xlsx', read_only=True, data_only=True)
rows = list(wb.worksheets[0].iter_rows(values_only=True))
h = {k: i for i, k in enumerate(rows[0])}
indb = {r[0]: r for r in rows[1:]}
for code, name, cat, _ in INDB:
    r = indb.get(code)
    if r is None:
        rejected.append(f'{code} {name}: not in INDB')
        continue
    g = lambda k: num(r[h[k]])
    per100 = {'kcal': g('energy_kcal'), 'protein': g('protein_g'), 'carbs': g('carb_g'), 'fat': g('fat_g'), 'fibre': g('fibre_g')}
    if any(per100[k] is None for k in ('kcal', 'protein', 'carbs', 'fat')):
        rejected.append(f'{code} {name}: missing macro')
        continue
    serving = None
    sk, sp = g('unit_serving_energy_kcal'), g('unit_serving_protein_g')
    unit = r[h['servings_unit']]
    if sk and per100['kcal']:
        grams = sk / per100['kcal'] * 100
        grams_p = (sp / per100['protein'] * 100) if (sp and per100['protein']) else grams
        if code in DROP_SERVING:
            rejected.append(f'{code} {name}: INDB serving "{unit}" = {grams:.0f} g implausible — per-100 g only')
        elif 15 <= grams <= 600 and abs(grams - grams_p) <= 0.02 * grams and unit:
            unit = RELABEL_SERVING.get(code, unit)
            serving = {'label': f'1 {unit} ({round(grams)} g)', 'grams': round(grams)}
        else:
            rejected.append(f'{code} {name}: serving {grams:.0f} g not plausible — per-100 g only')
    add(f'indb-{code}', name, cat, per100, serving, f'{INDB_CITE}; INDB {code} ({r[1].strip()})', code)

# IFCT
ifct_rows = list(csv.reader(open(IFCT_CSV, encoding='utf-8')))
ih = {c.split('; ')[-1]: i for i, c in enumerate(ifct_rows[0])}
ifct = {r[ih['code']]: r for r in ifct_rows[1:]}
for code, name, cat, grams, label in IFCT:
    r = ifct[code]
    fat = num(r[ih['fatce']])
    kj = num(r[ih['enerc']])
    p, c, fib = num(r[ih['protcnt']]), num(r[ih['choavldf']]) or 0.0, num(r[ih['fibtg']])
    if kj:
        kcal = kj / 4.184
        src = f'{IFCT_CITE}; IFCT {code} ({r[ih["name"]]})'
    else:  # IFCT lists no energy for pure fats; derive from its fat value
        kcal = fat * 9
        src = f'{IFCT_CITE}; IFCT {code} ({r[ih["name"]]}); energy = fat × 9 kcal/g (Atwater)'
    add(f'ifct-{code}', name, cat, {'kcal': kcal, 'protein': p, 'carbs': c, 'fat': fat, 'fibre': fib},
        {'label': label, 'grams': grams}, src, code)

# UK / US via INDB
for fname, code, name, cat, grams, label in EXTRA:
    wbx = openpyxl.load_workbook(f'{INDB_DIR}/{fname}', read_only=True, data_only=True)
    xr = list(wbx.worksheets[0].iter_rows(values_only=True))
    xh = {k: i for i, k in enumerate(xr[0])}
    row = next((r for r in xr[1:] if r[xh['food_code']] == code), None)
    if row is None:
        rejected.append(f'{code} {name}: not found in {fname}')
        continue
    g = lambda k: num(row[xh[k]])
    cite = COFID_CITE if fname.startswith('UK') else USDA_CITE
    add(f'{"uk" if fname.startswith("UK") else "us"}-{code}', name, cat,
        {'kcal': g('energy_kcal'), 'protein': g('protein_g'), 'carbs': g('carb_g'), 'fat': g('fat_g'), 'fibre': g('fibre_g')},
        {'label': label, 'grams': grams}, f'{cite}; {row[xh["food_code_org"]]} ({row[xh["food_name"]]})', code)

ids = [f['id'] for f in foods]
assert len(ids) == len(set(ids)), 'duplicate ids'
json.dump({
    'note': 'Values per 100 g edible portion. Each item cites its source. Built by scripts/foods/build_foods.py.',
    'sources': [INDB_CITE, IFCT_CITE, COFID_CITE, USDA_CITE],
    'foods': foods,
}, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'{len(foods)} foods written to {OUT}')
print(f'{len(rejected)} items rejected or flagged:')
for r in rejected:
    print('  -', r)
