module primegate::registry {
    use std::signer;
    use std::vector;
    use aptos_framework::aptos_account;
    use aptos_framework::aptos_coin;
    use aptos_framework::timestamp;

    const E_ALREADY_PURCHASED: u64 = 1;
    const E_INVALID_PACKAGE_ID: u64 = 2;
    const E_INVALID_PRICE: u64 = 3;
    const E_LISTING_NOT_FOUND: u64 = 4;
    const E_LISTING_NOT_INITIALIZED: u64 = 5;
    const E_LISTING_NOT_ACTIVE: u64 = 6;
    const E_UNAUTHORIZED_SELLER: u64 = 7;

    struct Listing has copy, drop, store {
        id: u64,
        package_id: vector<u8>,
        seller: address,
        price_octas: u64,
        active: bool,
        created_at_secs: u64,
        updated_at_secs: u64,
    }

    struct PurchaseReceipt has copy, drop, store {
        listing_id: u64,
        package_id: vector<u8>,
        seller: address,
        buyer: address,
        price_octas: u64,
        purchased_at_secs: u64,
    }

    struct Registry has key {
        next_listing_id: u64,
        listings: vector<Listing>,
        purchases: vector<PurchaseReceipt>,
    }

    fun init_module(account: &signer) {
        move_to(
            account,
            Registry {
                next_listing_id: 1,
                listings: vector::empty<Listing>(),
                purchases: vector::empty<PurchaseReceipt>(),
            },
        );
    }

    public entry fun upsert_listing(
        account: &signer,
        package_id: vector<u8>,
        price_octas: u64,
    ) acquires Registry {
        assert!(vector::length(&package_id) > 0, E_INVALID_PACKAGE_ID);
        assert!(price_octas > 0, E_INVALID_PRICE);
        assert!(exists<Registry>(@primegate), E_LISTING_NOT_INITIALIZED);

        let seller = signer::address_of(account);
        let registry = borrow_global_mut<Registry>(@primegate);
        let now = timestamp::now_seconds();
        let listing_index = find_listing_index(&registry.listings, &package_id);

        if (listing_index < vector::length(&registry.listings)) {
            let listing = vector::borrow_mut(&mut registry.listings, listing_index);
            assert!(listing.seller == seller, E_UNAUTHORIZED_SELLER);
            listing.price_octas = price_octas;
            listing.active = true;
            listing.updated_at_secs = now;
            return;
        };

        let listing_id = registry.next_listing_id;
        registry.next_listing_id = listing_id + 1;

        vector::push_back(
            &mut registry.listings,
            Listing {
                id: listing_id,
                package_id,
                seller,
                price_octas,
                active: true,
                created_at_secs: now,
                updated_at_secs: now,
            },
        );
    }

    public entry fun deactivate_listing(account: &signer, package_id: vector<u8>) acquires Registry {
        assert!(vector::length(&package_id) > 0, E_INVALID_PACKAGE_ID);
        assert!(exists<Registry>(@primegate), E_LISTING_NOT_INITIALIZED);

        let seller = signer::address_of(account);
        let registry = borrow_global_mut<Registry>(@primegate);
        let listing_index = find_listing_index(&registry.listings, &package_id);
        assert!(listing_index < vector::length(&registry.listings), E_LISTING_NOT_FOUND);

        let listing = vector::borrow_mut(&mut registry.listings, listing_index);
        assert!(listing.seller == seller, E_UNAUTHORIZED_SELLER);
        listing.active = false;
        listing.updated_at_secs = timestamp::now_seconds();
    }

    public entry fun purchase_package(account: &signer, package_id: vector<u8>) acquires Registry {
        assert!(vector::length(&package_id) > 0, E_INVALID_PACKAGE_ID);
        assert!(exists<Registry>(@primegate), E_LISTING_NOT_INITIALIZED);

        let registry = borrow_global_mut<Registry>(@primegate);
        let buyer = signer::address_of(account);
        let listing_index = find_listing_index(&registry.listings, &package_id);
        assert!(listing_index < vector::length(&registry.listings), E_LISTING_NOT_FOUND);

        let listing = *vector::borrow(&registry.listings, listing_index);
        assert!(listing.active, E_LISTING_NOT_ACTIVE);
        assert!(!has_purchase_for_listing(&registry.purchases, listing.id, buyer), E_ALREADY_PURCHASED);

        aptos_account::transfer_coins<aptos_coin::AptosCoin>(account, listing.seller, listing.price_octas);

        vector::push_back(
            &mut registry.purchases,
            PurchaseReceipt {
                listing_id: listing.id,
                package_id,
                seller: listing.seller,
                buyer,
                price_octas: listing.price_octas,
                purchased_at_secs: timestamp::now_seconds(),
            },
        );
    }

    #[view]
    public fun has_active_listing(package_id: vector<u8>): bool acquires Registry {
        if (!exists<Registry>(@primegate)) {
            return false
        };

        let registry = borrow_global<Registry>(@primegate);
        let listing_index = find_listing_index(&registry.listings, &package_id);
        if (listing_index >= vector::length(&registry.listings)) {
            return false
        };

        vector::borrow(&registry.listings, listing_index).active
    }

    #[view]
    public fun get_active_listing_seller(package_id: vector<u8>): address acquires Registry {
        if (!exists<Registry>(@primegate)) {
            return @0x0
        };

        let registry = borrow_global<Registry>(@primegate);
        let listing_index = find_listing_index(&registry.listings, &package_id);
        if (listing_index >= vector::length(&registry.listings)) {
            return @0x0
        };

        let listing = vector::borrow(&registry.listings, listing_index);
        if (!listing.active) {
            return @0x0
        };

        listing.seller
    }

    #[view]
    public fun get_active_listing_price(package_id: vector<u8>): u64 acquires Registry {
        if (!exists<Registry>(@primegate)) {
            return 0
        };

        let registry = borrow_global<Registry>(@primegate);
        let listing_index = find_listing_index(&registry.listings, &package_id);
        if (listing_index >= vector::length(&registry.listings)) {
            return 0
        };

        let listing = vector::borrow(&registry.listings, listing_index);
        if (!listing.active) {
            return 0
        };

        listing.price_octas
    }

    #[view]
    public fun has_purchase(package_id: vector<u8>, buyer: address): bool acquires Registry {
        if (!exists<Registry>(@primegate)) {
            return false
        };

        let registry = borrow_global<Registry>(@primegate);
        let listing_index = find_listing_index(&registry.listings, &package_id);
        if (listing_index >= vector::length(&registry.listings)) {
            return false
        };

        let listing = vector::borrow(&registry.listings, listing_index);
        has_purchase_for_listing(&registry.purchases, listing.id, buyer)
    }

    fun find_listing_index(listings: &vector<Listing>, package_id: &vector<u8>): u64 {
        let total = vector::length(listings);
        let i = 0;
        while (i < total) {
            let listing = vector::borrow(listings, i);
            if (&listing.package_id == package_id || listing.package_id == *package_id) {
                return i
            };
            i = i + 1;
        };

        total
    }

    fun has_purchase_for_listing(
        purchases: &vector<PurchaseReceipt>,
        listing_id: u64,
        buyer: address,
    ): bool {
        let total = vector::length(purchases);
        let i = 0;
        while (i < total) {
            let purchase = vector::borrow(purchases, i);
            if (purchase.listing_id == listing_id && purchase.buyer == buyer) {
                return true
            };
            i = i + 1;
        };

        false
    }
}
