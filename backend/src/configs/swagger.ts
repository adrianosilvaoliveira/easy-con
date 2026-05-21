import swaggerJsdoc from 'swagger-jsdoc';
import { env } from './env';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Easy Stock API',
      version: '1.0.0',
      description: 'API do Easy Stock — controle de estoque hospitalar oftalmológico',
    },
    servers: [{ url: `${env.API_URL}/api` }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/*.ts', './src/modules/**/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
