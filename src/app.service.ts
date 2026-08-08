// import { Injectable } from '@nestjs/common';

// @Injectable()
// export class AppService {
//   getHello(): string {
//     return 'Hello World!';
//   }
// }
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'DotSkills SaaS API';
  }

  getHealth() {
    return {
      success: true,
      message: 'DotSkills SaaS API is running',
      timestamp: new Date().toISOString(),
    };
  }
}