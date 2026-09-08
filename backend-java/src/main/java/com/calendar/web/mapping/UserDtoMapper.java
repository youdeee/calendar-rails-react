package com.calendar.web.mapping;

import com.calendar.domain.User;
import com.calendar.web.dto.UserResponse;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface UserDtoMapper {
    UserResponse toResponse(User user);
}
