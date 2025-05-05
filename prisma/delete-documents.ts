// Script to delete all documents from the database
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Deleting all documents from the database...');
    
    const deletedDocuments = await prisma.document.deleteMany({});
    
    console.log(`Successfully deleted ${deletedDocuments.count} documents`);
  } catch (error) {
    console.error('Error deleting documents:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
