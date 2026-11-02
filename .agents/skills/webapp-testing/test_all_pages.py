# -*- coding: utf-8 -*-
"""
Comprehensive testing script for Finance Management System
Tests all pages for errors, loading issues, and basic functionality
"""
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from playwright.sync_api import sync_playwright, Page
import time
import json

BASE_URL = "http://127.0.0.1:8000"
RESULTS = []

def log(status, page_name, url, message="", screenshot=None):
    icon = "[PASS]" if status == "PASS" else "[FAIL]" if status == "FAIL" else "[WARN]"
    entry = {
        "status": status,
        "page": page_name,
        "url": url,
        "message": message,
        "screenshot": screenshot
    }
    RESULTS.append(entry)
    print(f"{icon} {page_name}: {message}")

def check_for_errors(page: Page, page_name: str, url: str):
    """Check page for common error indicators"""
    errors = []

    # Check for Laravel error page
    if page.locator("text=Whoops, looks like something went wrong").count() > 0:
        errors.append("Laravel error page detected")

    # Check for 500 error
    if page.locator("text=500").count() > 0 and page.locator("text=Server Error").count() > 0:
        errors.append("500 Server Error detected")

    # Check for exception in URL
    if "error" in page.url and page.locator("text=Exception").count() > 0:
        errors.append("Exception page detected")

    return errors

def test_page(page: Page, page_name: str, url: str):
    """Navigate to URL and check for errors"""
    console_errors = []

    def capture_console(msg):
        if msg.type == "error":
            text = msg.text
            # Skip non-critical errors
            if not any(skip in text.lower() for skip in [
                "favicon", "net::err_aborted", "hot-update", "vite", "hmr",
                "websocket", "wss://", "ws://", "livewire.min.js.map"
            ]):
                console_errors.append(text)

    page.on("console", capture_console)

    try:
        page.goto(url, timeout=30000)
        page.wait_for_load_state("networkidle", timeout=20000)
        time.sleep(0.5)

        errors = check_for_errors(page, page_name, url)

        if errors:
            screenshot_path = f"C:/tmp/error_{page_name.replace(' ', '_').lower()}.png"
            page.screenshot(path=screenshot_path, full_page=True)
            log("FAIL", page_name, url, " | ".join(errors), screenshot_path)
            return False
        elif console_errors:
            log("WARN", page_name, url, f"JS errors: {console_errors[0][:80]}")
            return True
        else:
            log("PASS", page_name, url, "Page loaded OK")
            return True
    except Exception as e:
        err_msg = str(e)[:120]
        log("FAIL", page_name, url, f"Exception: {err_msg}")
        return False
    finally:
        page.remove_listener("console", capture_console)

def login(page: Page):
    """Login as admin user (Livewire form)"""
    print("\n--- Logging in as admin ---")
    page.goto(f"{BASE_URL}/login", timeout=30000)
    page.wait_for_load_state("networkidle")
    time.sleep(1)  # wait for Livewire to initialize

    # Fill form and trigger Livewire input events
    page.fill('input[type="email"]', "admin@gmail.com")
    page.dispatch_event('input[type="email"]', "input")
    time.sleep(0.3)

    page.fill('input[type="password"]', "password")
    page.dispatch_event('input[type="password"]', "input")
    time.sleep(0.3)

    page.click('button[type="submit"]')

    try:
        page.wait_for_url(lambda url: "login" not in url, timeout=15000)
        print("Login successful!")
        return True
    except Exception:
        page.screenshot(path="C:/tmp/login_failed.png")
        print("Login FAILED!")
        return False

def test_modal(page: Page, page_url: str, modal_name: str, button_texts: list):
    """Test that a modal opens without errors"""
    try:
        page.goto(page_url, timeout=30000)
        page.wait_for_load_state("networkidle")

        selector = ", ".join([f"button:has-text('{t}')" for t in button_texts])
        btn = page.locator(selector)

        if btn.count() > 0:
            btn.first.click()
            page.wait_for_timeout(2000)
            errors = check_for_errors(page, modal_name, page_url)
            if errors:
                log("FAIL", modal_name, page_url, " | ".join(errors))
            else:
                log("PASS", modal_name, page_url, "Modal opened OK")
        else:
            log("WARN", modal_name, page_url, f"Button not found ({', '.join(button_texts)})")
    except Exception as e:
        log("FAIL", modal_name, page_url, str(e)[:100])

def main():
    print("=" * 70)
    print("FINANCE MANAGEMENT SYSTEM - COMPREHENSIVE PAGE TESTING")
    print("=" * 70)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 720})
        page = context.new_page()

        # Check server reachable
        try:
            page.goto(BASE_URL, timeout=10000)
            page.wait_for_load_state("domcontentloaded")
        except Exception as e:
            print(f"Server not reachable at {BASE_URL}: {e}")
            browser.close()
            return

        # Login
        if not login(page):
            log("FAIL", "Login", f"{BASE_URL}/login", "Cannot login - aborting tests")
            browser.close()
            return

        log("PASS", "Login", f"{BASE_URL}/login", "Login successful")

        # ============================================================
        # PHASE 1: Core Pages
        # ============================================================
        print("\n--- PHASE 1: Core Pages ---")
        core_pages = [
            ("Dashboard",           f"{BASE_URL}/dashboard"),
            ("Clients",             f"{BASE_URL}/clients"),
            ("Services",            f"{BASE_URL}/services"),
            ("Invoices Index",      f"{BASE_URL}/invoices"),
            ("Invoices Create",     f"{BASE_URL}/invoices/create"),
            ("Bank Accounts",       f"{BASE_URL}/bank-accounts"),
        ]
        for name, url in core_pages:
            test_page(page, name, url)

        # ============================================================
        # PHASE 2: Cash Flow
        # ============================================================
        print("\n--- PHASE 2: Cash Flow ---")
        cashflow_pages = [
            ("Cash Flow Overview",  f"{BASE_URL}/cash-flow"),
            ("Cash Flow Income",    f"{BASE_URL}/cash-flow/income"),
            ("Cash Flow Expenses",  f"{BASE_URL}/cash-flow/expenses"),
            ("Cash Flow Transfers", f"{BASE_URL}/cash-flow/transfers"),
        ]
        for name, url in cashflow_pages:
            test_page(page, name, url)

        # ============================================================
        # PHASE 3: Recurring Invoices
        # ============================================================
        print("\n--- PHASE 3: Recurring Invoices ---")
        recurring_pages = [
            ("Recurring Invoices",         f"{BASE_URL}/recurring-invoices"),
            ("Recurring Template Create",  f"{BASE_URL}/recurring-invoices/template/create"),
        ]
        for name, url in recurring_pages:
            test_page(page, name, url)

        # ============================================================
        # PHASE 4: Financial Modules
        # ============================================================
        print("\n--- PHASE 4: Financial Modules ---")
        financial_pages = [
            ("Reimbursements",         f"{BASE_URL}/reimbursements"),
            ("Fund Requests",          f"{BASE_URL}/fund-requests"),
            ("Loans",                  f"{BASE_URL}/loans"),
            ("Receivables",            f"{BASE_URL}/receivables"),
            ("Transaction Categories", f"{BASE_URL}/transaction-categories"),
        ]
        for name, url in financial_pages:
            test_page(page, name, url)

        # ============================================================
        # PHASE 5: Admin & Settings
        # ============================================================
        print("\n--- PHASE 5: Admin & Settings ---")
        admin_pages = [
            ("Feedbacks",          f"{BASE_URL}/feedbacks"),
            ("Permissions",        f"{BASE_URL}/permissions"),
            ("Admin Users",        f"{BASE_URL}/admin/users"),
            ("Settings Profile",   f"{BASE_URL}/settings/profile"),
            ("Settings Password",  f"{BASE_URL}/settings/password"),
            ("Settings Company",   f"{BASE_URL}/settings/company"),
        ]
        for name, url in admin_pages:
            test_page(page, name, url)

        # ============================================================
        # PHASE 6: Modal Tests
        # ============================================================
        print("\n--- PHASE 6: Modal / Dialog Tests ---")

        test_modal(page, f"{BASE_URL}/clients", "Client Create Modal",
                   ["Tambah Client", "Tambah", "Add", "Baru", "New Client"])

        test_modal(page, f"{BASE_URL}/services", "Service Create Modal",
                   ["Tambah Service", "Tambah", "Add", "Baru"])

        test_modal(page, f"{BASE_URL}/bank-accounts", "Bank Account Create Modal",
                   ["Buat"])  # wire:click="createAccount" renders as "Buat"

        test_modal(page, f"{BASE_URL}/reimbursements", "Reimbursement Create Modal",
                   ["Ajukan", "Tambah", "Baru", "New"])

        test_modal(page, f"{BASE_URL}/fund-requests", "Fund Request Create Modal",
                   ["Buat Pengajuan", "Tambah", "Ajukan", "New"])

        test_modal(page, f"{BASE_URL}/loans", "Loan Create Modal",
                   ["Catat Pinjaman", "Tambah", "Add", "Baru"])

        # Transaction Categories uses embedded form, not a modal button
        log("WARN", "Category Create Modal", f"{BASE_URL}/transaction-categories",
            "Form embedded on page - no separate modal button (by design)")

        # ============================================================
        # PHASE 7: Screenshots of Key Pages
        # ============================================================
        print("\n--- PHASE 7: Final Screenshots ---")
        for name, url in [
            ("dashboard",       f"{BASE_URL}/dashboard"),
            ("invoices",        f"{BASE_URL}/invoices"),
            ("clients",         f"{BASE_URL}/clients"),
            ("cash_flow",       f"{BASE_URL}/cash-flow"),
            ("bank_accounts",   f"{BASE_URL}/bank-accounts"),
        ]:
            try:
                page.goto(url, timeout=30000)
                page.wait_for_load_state("networkidle")
                path = f"C:/tmp/screenshot_{name}.png"
                page.screenshot(path=path, full_page=True)
                print(f"  Screenshot: {path}")
            except Exception as e:
                print(f"  Screenshot failed ({name}): {e}")

        browser.close()

    # ============================================================
    # FINAL REPORT
    # ============================================================
    print("\n" + "=" * 70)
    print("TESTING SUMMARY REPORT")
    print("=" * 70)

    passed = [r for r in RESULTS if r["status"] == "PASS"]
    failed = [r for r in RESULTS if r["status"] == "FAIL"]
    warned = [r for r in RESULTS if r["status"] == "WARN"]

    print(f"\nPASSED : {len(passed)}")
    print(f"FAILED : {len(failed)}")
    print(f"WARNED : {len(warned)}")
    print(f"TOTAL  : {len(RESULTS)}")

    if failed:
        print("\nFAILED PAGES:")
        for r in failed:
            print(f"  - {r['page']}: {r['message']}")
            if r.get('screenshot'):
                print(f"    Screenshot: {r['screenshot']}")

    if warned:
        print("\nWARNINGS:")
        for r in warned:
            print(f"  - {r['page']}: {r['message']}")

    print("\n" + "=" * 70)

    with open("C:/tmp/test_results.json", "w", encoding="utf-8") as f:
        json.dump(RESULTS, f, indent=2, ensure_ascii=False)
    print("Full results saved to C:/tmp/test_results.json")

    return len(failed) == 0

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
