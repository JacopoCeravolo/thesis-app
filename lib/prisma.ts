import { PrismaClient } from '@prisma/client';

// Create a singleton Prisma client instance to avoid too many connections
declare global {
  var prisma: PrismaClient | undefined;
}

// Print all available model names when initializing in development
const prismaClient = global.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prismaClient;
  console.log('Available Prisma models:');
  console.log(Object.keys(prismaClient));
}

export default prismaClient;
