#!/bin/bash
# Migration script for decryption_status table - Linux/Mac version
# This script creates the decryption_status table for tracking guardian decryption progress

echo "========================================"
echo "Decryption Status Table Migration"
echo "========================================"
echo ""
echo "This script will create the decryption_status table in your MySQL database."
echo ""

# Prompt for database credentials
read -p "Enter MySQL username (default: root): " DB_USER
DB_USER=${DB_USER:-root}

read -p "Enter database name (default: amarvote): " DB_NAME
DB_NAME=${DB_NAME:-amarvote}

echo ""
echo "Connecting to database: $DB_NAME as user: $DB_USER"
echo ""
echo "You will be prompted for your MySQL password..."
echo ""

# Execute the SQL script
mysql -u "$DB_USER" -p "$DB_NAME" < Database/decryption_status_table.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "========================================"
    echo "Migration completed successfully!"
    echo "========================================"
    echo ""
    echo "The decryption_status table has been created."
    echo "You can now restart your backend application."
    echo ""
else
    echo ""
    echo "========================================"
    echo "Migration failed!"
    echo "========================================"
    echo ""
    echo "Please check the error messages above."
    echo "Make sure:"
    echo "  1. MySQL is running"
    echo "  2. Database credentials are correct"
    echo "  3. Database '$DB_NAME' exists"
    echo "  4. You have proper permissions"
    echo ""
fi
