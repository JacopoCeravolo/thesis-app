# Setting up Vercel Blob Storage

To use Vercel Blob Storage in your local development environment, you need to set up a `BLOB_READ_WRITE_TOKEN` environment variable.

## Steps to configure Blob Storage

1. Create a `.env.local` file in the root of your project with the following content:

```
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token_here
```

2. To get a Vercel Blob token:
   - Go to the [Vercel Dashboard](https://vercel.com/dashboard)
   - Navigate to your project settings
   - Go to the "Storage" tab
   - Create a new Blob store or select an existing one
   - Generate a new token with read/write permissions
   - Copy the token value

3. Restart your development server after creating the `.env.local` file

## Alternative Approach

If you want to temporarily bypass Vercel Blob during local development, you can modify your `lib/blobStorage.ts` file to use a mock storage system for local development.

## For Production

Make sure to set the `BLOB_READ_WRITE_TOKEN` in your Vercel project environment variables when you deploy.
