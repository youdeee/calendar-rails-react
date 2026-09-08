package com.calendar.infrastructure.persistence;

import com.calendar.domain.User;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface UserMapper {
    User findById(@Param("id") Long id);

    User findByEmail(@Param("email") String email);

    int insert(User user);

    int update(User user);
}
