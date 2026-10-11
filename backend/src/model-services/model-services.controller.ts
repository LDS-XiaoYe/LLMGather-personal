import { Body, Controller, Get, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthenticatedRequestUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { ModelServicesService } from './model-services.service';
import { DeploymentConfig } from './model.types';

@Controller('admin/model-services')
@UseGuards(JwtAuthGuard,AdminGuard)
export class ModelServicesController {
  constructor(private readonly services:ModelServicesService){}
  @Get() async list(){return{data:await this.services.snapshot()};}
  @Post('nodes') async register(@CurrentUser() user:AuthenticatedRequestUser,@Body() input:{id:string;name:string;baseUrl:string;token:string}){return{data:await this.services.registerNode(user.id,input)};}
  @Post('tasks') async task(@CurrentUser() user:AuthenticatedRequestUser,@Body() input:{taskId:string;instanceId:string;nodeId?:string;action:string;config?:DeploymentConfig;confirm?:boolean}){return{data:await this.services.enqueue(user.id,input)};}
  @Post('tasks/:id/cancel') async cancel(@CurrentUser() user:AuthenticatedRequestUser,@Param('id') id:string){return{data:await this.services.cancel(user.id,id)};}
  @Get('instances/:id/dependencies') async dependencies(@Param('id') id:string){return{data:await this.services.dependencies(id)};}
  @Get('instances/:id/logs') async logs(@Param('id') id:string){return{data:await this.services.details(id,'logs')};}
  @Get('instances/:id/metrics') async metrics(@Param('id') id:string){return{data:await this.services.details(id,'metrics')};}
  @Post('instances/:id/default') async setDefault(@CurrentUser() user:AuthenticatedRequestUser,@Param('id') id:string){return{data:await this.services.setDefault(user.id,id)};}
  @Get('events') async stream(@Req() req:Request,@Res() res:Response,@Query('after') after?:string){
    let cursor=Math.max(0,Math.floor(Number(after)||0)),closed=false,running=false,lastSnapshot=0;
    res.setHeader('Content-Type','text/event-stream');res.setHeader('Cache-Control','no-cache');res.setHeader('X-Accel-Buffering','no');res.flushHeaders();
    const poll=async()=>{if(closed||running)return;running=true;try{const events=await this.services.events(cursor);
      for(const e of events){cursor=Number(e.id);if(!res.write(`id: ${cursor}\ndata: ${JSON.stringify({taskId:e.taskId,...JSON.parse(String(e.payloadJson))})}\n\n`))break;}
      if(!events.length)res.write(': heartbeat\n\n');
      if(Date.now()-lastSnapshot>10000){lastSnapshot=Date.now();res.write(`data: ${JSON.stringify({snapshot:await this.services.snapshot()})}\n\n`);}
    }catch{res.end();closed=true;}finally{running=false;}};
    const expiry=setTimeout(()=>res.end(),300000);
    const timer=setInterval(()=>void poll(),1000);req.on('close',()=>{closed=true;clearInterval(timer);clearTimeout(expiry);});void poll();
  }
}
