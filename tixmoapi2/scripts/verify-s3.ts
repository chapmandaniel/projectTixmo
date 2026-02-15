import { ListObjectsV2Command, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, S3_BUCKET } from '../src/config/s3';
import dotenv from 'dotenv';

// Load env vars
dotenv.config();

async function verifyS3() {
    console.log('🔍 Verifying S3 Configuration...');
    console.log(`   Bucket: ${S3_BUCKET}`);
    console.log(`   Endpoint: ${process.env.S3_ENDPOINT || process.env.AWS_ENDPOINT || 'Not set'}`);
    console.log(`   Region: ${process.env.S3_REGION || process.env.AWS_REGION || 'us-east-1'}`);

    if (!process.env.S3_ACCESS_KEY_ID && !process.env.AWS_ACCESS_KEY_ID) {
        console.error('❌ Missing Access Key ID (S3_ACCESS_KEY_ID or AWS_ACCESS_KEY_ID)');
        process.exit(1);
    }
    if (!process.env.S3_SECRET_ACCESS_KEY && !process.env.AWS_SECRET_ACCESS_KEY) {
        console.error('❌ Missing Secret Access Key (S3_SECRET_ACCESS_KEY or AWS_SECRET_ACCESS_KEY)');
        process.exit(1);
    }

    try {
        console.log('\n📡 Testing Connection (List Objects)...');
        const listCmd = new ListObjectsV2Command({
            Bucket: S3_BUCKET,
            MaxKeys: 1
        });
        await s3Client.send(listCmd);
        console.log('✅ Connection Successful!');

        console.log('\n📤 Testing Upload...');
        const testKey = `verify-s3-${Date.now()}.txt`;
        const putCmd = new PutObjectCommand({
            Bucket: S3_BUCKET,
            Key: testKey,
            Body: 'S3 Integration Verification',
            ContentType: 'text/plain'
        });
        await s3Client.send(putCmd);
        console.log(`✅ Upload Successful (${testKey})`);

        console.log('\n🗑️  Cleaning up...');
        const deleteCmd = new DeleteObjectCommand({
            Bucket: S3_BUCKET,
            Key: testKey
        });
        await s3Client.send(deleteCmd);
        console.log('✅ Cleanup Successful');

        console.log('\n🎉 S3 Integration Verified!');
        process.exit(0);
    } catch (error: any) {
        console.error('\n❌ Verification Failed:');
        console.error(error.message);
        if (error.Code) console.error(`   Code: ${error.Code}`);
        if (error.$metadata) console.error(`   Request ID: ${error.$metadata.requestId}`);
        process.exit(1);
    }
}

verifyS3();
