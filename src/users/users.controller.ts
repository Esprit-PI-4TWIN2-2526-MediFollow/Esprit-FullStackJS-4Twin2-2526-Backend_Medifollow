import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './users.schema';

@Controller('apis')
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    // create user
    @Post('/signup')
    create(@Body() user: Partial<User>) {
        return this.usersService.create(user);
    }

    // get all users
    @Get('/all')
    findAll() {
        return this.usersService.findAll();
    }
    // get user by id
    @Get('/getById/:id')
    findOne(@Param('id') id: string) {
        return this.usersService.findOne(id);
    }
    // get user by email
    @Get('/users/email/:email')
    findByEmail(@Param('email') email: string) {
        return this.usersService.findByEmail(email);
    }

    // update user
    @Put('/update/:id')
    update(@Param('id') id: string, @Body() user: Partial<User>) {
        return this.usersService.update(id, user);
    }
    // delete user
    @Delete('/delete/:id')
    delete(@Param('id') id: string) {
        return this.usersService.delete(id);
    }
}
