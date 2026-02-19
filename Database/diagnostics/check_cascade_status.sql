-- Quick diagnostic: Check if CASCADE is enabled on worker log tables

SELECT
    tc.table_name as "Table",
    tc.constraint_name as "Constraint Name",
    ccu.table_name as "References Table",
    rc.delete_rule as "Delete Rule",
    CASE 
        WHEN rc.delete_rule = 'CASCADE' THEN '✅'
        WHEN rc.delete_rule = 'NO ACTION' THEN '❌'
        WHEN rc.delete_rule = 'RESTRICT' THEN '❌'
        ELSE '⚠️'
    END as "Status"
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
LEFT JOIN information_schema.referential_constraints AS rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.table_name IN ('tally_worker_log', 'decryption_worker_log', 'combine_worker_log')
    AND tc.constraint_type = 'FOREIGN KEY'
    AND ccu.table_name IN ('election_center', 'elections', 'guardians')
ORDER BY tc.table_name, ccu.table_name;
