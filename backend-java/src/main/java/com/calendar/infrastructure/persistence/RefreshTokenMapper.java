package com.calendar.infrastructure.persistence;

import com.calendar.domain.RefreshToken;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface RefreshTokenMapper {
    int insert(RefreshToken token);

    RefreshToken findByDigest(@Param("tokenDigest") String tokenDigest);

    int claimIfActive(@Param("id") Long id);

    int revokeAllActiveByUserId(@Param("userId") Long userId);

    int revoke(@Param("id") Long id);
}
