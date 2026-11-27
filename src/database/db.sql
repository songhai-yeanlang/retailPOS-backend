CREATE DATABASE IF NOT EXISTS retail_pos_db
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE retail_pos_db;

-- ==========================================
-- 1. Settings Table (Shop Information & Exchange Rate)
-- ==========================================
CREATE TABLE IF NOT EXISTS settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    shop_name VARCHAR(150) NOT NULL,
    phone VARCHAR(50),
    address TEXT,
    exchange_rate DECIMAL(12, 2) NOT NULL DEFAULT 4100.00,
    receipt_footer VARCHAR(255) DEFAULT 'Thank you! Please come again.',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ==========================================
-- 2. Users Table (Staff / System Accounts)
-- ==========================================
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) UNIQUE NULL,                      
    password VARCHAR(255) NOT NULL,                     
    role ENUM('owner', 'manager', 'cashier') NOT NULL DEFAULT 'cashier',
    is_active TINYINT(1) NOT NULL DEFAULT 1,            
    reset_token VARCHAR(255) NULL,                        
    reset_token_expires DATETIME NULL,                  
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ==========================================
-- 3. Refresh Tokens Table (JWT Auth Sessions)
-- ==========================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token VARCHAR(500) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_refresh_tokens_user (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ==========================================
-- 4. Categories Table (Product Categories)
-- ==========================================
CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ==========================================
-- 5. Suppliers Table (Vendors / Distributors)
-- ==========================================
CREATE TABLE IF NOT EXISTS suppliers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(50),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ==========================================
-- 6. Products Table (Inventory / Items)
-- ==========================================
CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT,
    barcode VARCHAR(100) UNIQUE,
    name VARCHAR(150) NOT NULL,
    cost_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    sell_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    stock_qty INT NOT NULL DEFAULT 0,
    alert_qty INT NOT NULL DEFAULT 5,
    unit VARCHAR(50) NOT NULL DEFAULT 'pcs',
    image VARCHAR(255),
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_products_name (name),
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ==========================================
-- 7. Customers Table (Buyers / Members)
-- ==========================================
CREATE TABLE IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(50),
    address TEXT,
    points INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_customers_phone (phone)
) ENGINE=InnoDB;

-- ==========================================
-- 8. Payment Methods Table (Cash, ABA KHQR, ACLEDA KHQR, etc.)
-- ==========================================
CREATE TABLE IF NOT EXISTS payment_methods (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,                      
    type ENUM('cash', 'qr', 'card', 'other') NOT NULL DEFAULT 'cash',
    account_name VARCHAR(100) NULL,                        
    account_number VARCHAR(50) NULL,                       
    qr_image VARCHAR(255) NULL,                            
    is_active TINYINT(1) NOT NULL DEFAULT 1,               
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ==========================================
-- 9. Sales Table (Sales Invoices / POS Headers)
-- ==========================================
CREATE TABLE IF NOT EXISTS sales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_no VARCHAR(50) NOT NULL UNIQUE,
    user_id INT NOT NULL,
    customer_id INT,
    payment_method_id INT NOT NULL,                       
    payment_ref VARCHAR(100) NULL,                        
    subtotal DECIMAL(12, 2) NOT NULL,
    discount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    tax DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(12, 2) NOT NULL,
    paid_amount DECIMAL(12, 2) NOT NULL,
    change_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,   
    exchange_rate DECIMAL(12, 2) NOT NULL DEFAULT 4100.00,
    status ENUM('completed', 'cancelled', 'refunded') NOT NULL DEFAULT 'completed',
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_sales_created_at (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ==========================================
-- 10. Sale Items Table (Line Items per Invoice)
-- ==========================================
CREATE TABLE IF NOT EXISTS sale_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sale_id INT NOT NULL,
    product_id INT NOT NULL,
    qty INT NOT NULL,
    cost_price DECIMAL(12, 2) NOT NULL,                   
    unit_price DECIMAL(12, 2) NOT NULL,                
    subtotal DECIMAL(12, 2) NOT NULL,                     
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ==========================================
-- 11. Purchases Table (Stock-In Headers)
-- ==========================================
CREATE TABLE IF NOT EXISTS purchases (
    id INT AUTO_INCREMENT PRIMARY KEY,
    reference_no VARCHAR(50) UNIQUE,
    supplier_id INT,
    user_id INT NOT NULL,
    total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    status ENUM('received', 'pending', 'cancelled') NOT NULL DEFAULT 'received',
    note TEXT,
    purchase_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_purchases_date (purchase_date),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ==========================================
-- 12. Purchase Items Table (Line Items per Purchase)
-- ==========================================
CREATE TABLE IF NOT EXISTS purchase_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    purchase_id INT NOT NULL,
    product_id INT NOT NULL,
    qty INT NOT NULL,
    cost_price DECIMAL(12, 2) NOT NULL,
    subtotal DECIMAL(12, 2) NOT NULL,
    FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ==========================================
-- 13. Audit Logs Table (Track Critical User Actions)
-- ==========================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,                                 
    action VARCHAR(50) NOT NULL,                          
    table_name VARCHAR(50) NOT NULL,                    
    record_id INT NULL,                                  
    old_values JSON NULL,                               
    new_values JSON NULL,                                  
    ip_address VARCHAR(45) NULL,                         
    user_agent VARCHAR(255) NULL,                         
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_user (user_id),
    INDEX idx_audit_table_record (table_name, record_id),
    INDEX idx_audit_created_at (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;


