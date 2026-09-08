package com.calendar.application;

import com.calendar.application.exception.UnprocessableException;
import com.calendar.domain.Recurrence;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

import java.util.LinkedHashMap;
import java.util.Map;

@Component
public class RecurrenceCodec {
    private final JsonMapper mapper = JsonMapper.builder().build();

    public String serialize(Recurrence recurrence) {
        if (recurrence == null) {
            return null;
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("frequency", recurrence.frequency());
        body.put("interval", recurrence.interval());
        if (recurrence.until() != null && !recurrence.until().isBlank()) {
            body.put("until", recurrence.until());
        }
        return mapper.writeValueAsString(body);
    }

    public Recurrence deserialize(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> body = mapper.readValue(json, Map.class);
            Object intervalValue = body.get("interval");
            int interval = intervalValue instanceof Number n ? n.intValue() : Integer.parseInt(String.valueOf(intervalValue));
            Object untilValue = body.get("until");
            String until = untilValue == null ? null : String.valueOf(untilValue);
            return new Recurrence(String.valueOf(body.get("frequency")), interval, until);
        } catch (RuntimeException e) {
            throw new UnprocessableException("recurrence_rule is not valid JSON");
        }
    }
}
