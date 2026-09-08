package com.calendar.infrastructure.persistence;

import org.apache.ibatis.annotations.Mapper;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.context.annotation.Configuration;

@Configuration
@MapperScan(basePackages = "com.calendar.infrastructure.persistence", annotationClass = Mapper.class)
public class PersistenceConfig {
}
