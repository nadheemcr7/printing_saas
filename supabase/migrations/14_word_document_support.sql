-- MODULAR SCHEMA: Word Document Support

-- Upgrade documents bucket to accept Word files and increase limit
UPDATE storage.buckets 
SET 
    file_size_limit = 26214400, -- 25MB
    allowed_mime_types = ARRAY[
        'application/pdf', 
        'application/msword', 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
WHERE id = 'documents';
