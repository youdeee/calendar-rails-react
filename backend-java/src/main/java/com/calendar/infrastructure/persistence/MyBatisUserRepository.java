package com.calendar.infrastructure.persistence;

import com.calendar.domain.User;
import com.calendar.domain.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
@RequiredArgsConstructor
public class MyBatisUserRepository implements UserRepository {
    private final UserMapper mapper;

    @Override
    public Optional<User> findById(Long id) {
        return Optional.ofNullable(mapper.findById(id));
    }

    @Override
    public Optional<User> findByEmail(String email) {
        return Optional.ofNullable(mapper.findByEmail(email));
    }

    @Override
    public User save(User user) {
        if (user.getId() == null) {
            mapper.insert(user);
        } else {
            mapper.update(user);
        }
        return user;
    }
}
